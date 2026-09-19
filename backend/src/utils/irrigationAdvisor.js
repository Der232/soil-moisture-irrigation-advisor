require('dotenv').config();
const { logIrrigationEvent, getMostRecentEventForZone } = require('../models/irrigationModel');
const { getZoneById } = require('../models/zoneModel');
const { reserveWater } = require('../models/reservoirModel');
const {
  calculateIrrigationVolume,
  moisturePercentToStorage,
  normalizeZoneParameters,
} = require('./engineeringModel');

// Fallback used only if a zone somehow has no threshold set (shouldn't happen
// since the schema defaults new zones to 30%, but kept as a safety net).
const DEFAULT_THRESHOLD = parseFloat(process.env.MOISTURE_THRESHOLD || '30');

// Minimum time between auto-triggered watering events for the same zone.
// This matters for real hardware: a relay-driven pump takes time to run and
// water takes time to absorb into soil, so re-evaluating every few seconds
// (the simulator's interval) must NOT fire the pump again on every single
// reading while the zone is still below threshold — that would flood the
// irrigation_events log and, on real hardware, chatter the relay/pump
// on and off far faster than the physical system can usefully respond to.
const COOLDOWN_MINUTES = parseFloat(process.env.IRRIGATION_COOLDOWN_MINUTES || '10');
const DEFAULT_DURATION_SECONDS = parseInt(process.env.IRRIGATION_DURATION_SECONDS || '30', 10);
const MAX_DURATION_SECONDS = parseInt(process.env.MAX_IRRIGATION_DURATION_SECONDS || '300', 10);

function buildPulseForZone(zone, moisturePercent, requestedDurationSeconds) {
  const parameters = normalizeZoneParameters({
    areaM2: zone?.area_m2,
    fieldCapacityMm: zone?.field_capacity_mm,
    wiltingPointMm: zone?.wilting_point_mm,
    moistureTargetPercent: zone?.moisture_target_percent,
    upperMoisturePercent: zone?.upper_moisture_percent,
    pumpFlowLpm: zone?.pump_flow_lpm,
    irrigationEfficiencyPercent: zone?.irrigation_efficiency_percent,
  });
  const threshold = Number(zone?.moisture_threshold ?? DEFAULT_THRESHOLD);
  const targetPercent = Math.max(
    threshold,
    Math.min(parameters.upperMoisturePercent, parameters.moistureTargetPercent)
  );
  const currentStorageMm = moisturePercentToStorage(moisturePercent, parameters);
  const targetStorageMm = moisturePercentToStorage(targetPercent, parameters);
  const targetRetainedVolumeL = Math.max(0, targetStorageMm - currentStorageMm) * parameters.areaM2;
  const targetDeliveredVolumeL =
    targetRetainedVolumeL / Math.max(0.01, parameters.irrigationEfficiencyPercent / 100);
  const targetDurationSeconds =
    targetDeliveredVolumeL / Math.max(0.001, parameters.pumpFlowLpm) * 60;
  const durationSeconds = Math.min(
    MAX_DURATION_SECONDS,
    Math.max(
      1,
      Number.isFinite(Number(requestedDurationSeconds))
        ? Number(requestedDurationSeconds)
        : Math.ceil(Math.max(DEFAULT_DURATION_SECONDS, targetDurationSeconds))
    )
  );

  return {
    parameters,
    targetPercent,
    durationSeconds,
    ...calculateIrrigationVolume({
      flowRateLpm: parameters.pumpFlowLpm,
      durationSeconds,
      efficiencyPercent: parameters.irrigationEfficiencyPercent,
      areaM2: parameters.areaM2,
    }),
  };
}

async function requestIrrigation({
  zoneId,
  moistureBefore = null,
  triggeredBy = 'auto',
  mode = triggeredBy === 'manual' ? 'manual' : 'automatic',
  durationSeconds,
  reason = null,
} = {}) {
  const zone = await getZoneById(zoneId);
  if (!zone) return { approved: false, reason: 'Zone not found' };

  const pulse = buildPulseForZone(zone, moistureBefore ?? zone.moisture_threshold, durationSeconds);
  const reservation = await reserveWater(pulse.requestedVolumeL);
  if (!reservation.approved) {
    const id = await logIrrigationEvent({
      zoneId,
      triggeredBy,
      moistureBefore,
      mode,
      status: 'blocked',
      reason: reservation.reason,
      durationSeconds: pulse.durationSeconds,
      requestedVolumeL: pulse.requestedVolumeL,
    });
    return {
      approved: false,
      watered: false,
      id,
      reason: reservation.reason,
      pulse,
      reservation,
    };
  }

  const id = await logIrrigationEvent({
    zoneId,
    triggeredBy,
    moistureBefore,
    mode,
    status: 'completed',
    reason,
    durationSeconds: pulse.durationSeconds,
    requestedVolumeL: pulse.requestedVolumeL,
    deliveredVolumeL: pulse.deliveredVolumeL,
    retainedVolumeL: pulse.retainedVolumeL,
    drainageVolumeL: Math.max(0, pulse.deliveredVolumeL - pulse.retainedVolumeL),
  });
  return {
    approved: true,
    watered: true,
    id,
    pulse,
    reservation,
  };
}

/**
 * Decide whether a zone needs watering, and log an irrigation event if so.
 * Each zone can have its own configurable moisture_threshold (e.g. thirstier
 * plants might want a higher threshold), rather than one global setting.
 * This is the rule-based "advisor" — simple, explainable logic rather than
 * ML, which is appropriate for a low-cost campus-scale system.
 *
 * A cooldown window prevents re-triggering on every reading while a zone
 * sits below threshold: once watering fires, it won't fire again for the
 * same zone until COOLDOWN_MINUTES has passed, even if subsequent readings
 * are still below threshold. This mirrors how a real pump/relay and
 * absorption-into-soil delay work, and is also the signal firmware should
 * use to decide whether to physically pulse a relay right now.
 */
async function evaluateZone({
  zoneId,
  moisturePercent,
  mode = 'automatic',
  sensorStatus = 'ok',
}) {
  const zone = await getZoneById(zoneId);
  const threshold = zone ? Number(zone.moisture_threshold) : DEFAULT_THRESHOLD;

  if (!zone) {
    return { watered: false, threshold, blocked: true, reason: 'Zone not found' };
  }

  if (sensorStatus !== 'ok') {
    return {
      watered: false,
      threshold,
      blocked: true,
      reason: `Sensor status is ${sensorStatus}; irrigation is inhibited`,
    };
  }

  if (mode === 'automatic' && zone?.operating_mode === 'manual') {
    return { watered: false, threshold, blocked: true, reason: 'Zone is in manual mode' };
  }

  if (moisturePercent >= threshold) {
    return { watered: false, threshold };
  }

  const recentEvent = await getMostRecentEventForZone(zoneId);
  if (recentEvent) {
    const minutesSinceLastEvent = (Date.now() - new Date(recentEvent.started_at).getTime()) / 60000;
    if (minutesSinceLastEvent < COOLDOWN_MINUTES) {
      // Still below threshold, but we already triggered watering recently —
      // don't log another event or tell hardware to fire the pump again yet.
      return { watered: false, threshold, withinCooldown: true };
    }
  }

  const irrigation = await requestIrrigation({
    zoneId,
    moistureBefore: moisturePercent,
    triggeredBy: 'auto',
    mode,
  });
  return {
    watered: irrigation.approved,
    threshold,
    targetPercent: irrigation.pulse?.targetPercent,
    irrigation,
  };
}

module.exports = {
  evaluateZone,
  requestIrrigation,
  buildPulseForZone,
  DEFAULT_THRESHOLD,
  COOLDOWN_MINUTES,
  DEFAULT_DURATION_SECONDS,
  MAX_DURATION_SECONDS,
};
