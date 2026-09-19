/**
 * In-browser simulation store that produces API-shaped data.
 *
 * Tries the real backend first; if it's unreachable, silently falls back
 * to the browser-based irrigation engine so the dashboard, log, and zone
 * management all work without a server or database.
 */
import {
  createDefaultZones,
  createReservoir,
  createZone,
  tickSimulation,
  manualWater,
} from '../simulation/irrigationEngine';

const TICK_MS = 2000;
const COOLDOWN_MINUTES = 10;
const SIMULATED_DAY_MINUTES = 10;

let zones = createDefaultZones();
let reservoir = createReservoir();
let listeners = new Set();
let intervalId = null;

function notify() {
  listeners.forEach((fn) => fn());
}

function startTicking() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    tickSimulation(zones, {
      cooldownMinutes: COOLDOWN_MINUTES,
      simulatedDayMinutes: SIMULATED_DAY_MINUTES,
      elapsedMinutes: 15,
      reservoir,
    });
    notify();
  }, TICK_MS);
}

function stopTicking() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

startTicking();

function toApiZone(z) {
  return {
    id: z.id,
    name: z.name,
    location_note: z.locationNote,
    grid_x: z.gridX,
    grid_y: z.gridY,
    moisture_threshold: z.moistureThreshold,
    area_m2: z.parameters.areaM2,
    soil_type: z.parameters.soilType,
    root_zone_depth_mm: z.parameters.rootZoneDepthMm,
    field_capacity_mm: z.parameters.fieldCapacityMm,
    wilting_point_mm: z.parameters.wiltingPointMm,
    moisture_target_percent: z.parameters.moistureTargetPercent,
    upper_moisture_percent: z.parameters.upperMoisturePercent,
    pump_flow_lpm: z.parameters.pumpFlowLpm,
    irrigation_efficiency_percent: z.parameters.irrigationEfficiencyPercent,
    drying_rate_factor: z.parameters.dryingRateFactor,
    operating_mode: z.operatingMode,
    created_at: new Date().toISOString(),
  };
}

function toApiReading(z) {
  const lastEvent = z.events[0];
  const irrigationActive = Boolean(
    lastEvent
    && lastEvent.status === 'completed'
    && lastEvent.timestamp === z.simulatedAtMs
  );
  return {
    zone_id: z.id,
    moisture_percent: z.currentMoisture,
    raw_adc: z.rawValue === null ? null : Math.round(z.rawValue),
    adc_bits: z.calibration.adcBits,
    sensor_voltage_v: z.rawValue === null ? null : Number(
      ((z.rawValue / 4095) * z.calibration.referenceVoltageV).toFixed(3)
    ),
    data_source: 'simulated',
    sensor_status: z.sensorStatus,
    irrigation_active: irrigationActive,
    storage_mm: Number(z.storageMm.toFixed(3)),
    recorded_at: new Date(z.simulatedAtMs).toISOString(),
  };
}

function toApiHistory(z) {
  return z.history.slice().reverse().map((h) => ({
    moisture_percent: h.moisture,
    true_moisture_percent: h.trueMoisture,
    storage_mm: h.storageMm,
    rainfall_mm: h.rainfallMm,
    evapotranspiration_mm: h.evapotranspirationMm,
    drainage_mm: h.drainageMm,
    irrigation_active: h.irrigationActive,
    recorded_at: new Date(h.timestamp).toISOString(),
  }));
}

function toApiEvent(e) {
  return {
    id: e.id,
    zone_id: e.zoneId,
    zone_name: e.zoneName,
    triggered_by: e.triggeredBy,
    mode: e.mode,
    status: e.status,
    reason: e.reason,
    moisture_before: e.moistureBefore,
    duration_seconds: e.durationSeconds,
    requested_volume_l: e.requestedVolumeL,
    delivered_volume_l: e.deliveredVolumeL,
    retained_volume_l: e.retainedVolumeL,
    drainage_volume_l: e.drainageVolumeL,
    started_at: new Date(e.timestamp).toISOString(),
  };
}

export const simStore = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  getZones() {
    return zones.map(toApiZone);
  },

  getLatestReadings() {
    return zones.map(toApiReading);
  },

  getHistory(zoneId) {
    const z = zones.find((z) => z.id === zoneId);
    return z ? toApiHistory(z) : [];
  },

  getEvents() {
    return zones
      .flatMap((z) => z.events)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
      .map(toApiEvent);
  },

  getSystemStatus() {
    return {
      mode: 'simulation',
      operatingModes: ['manual', 'automatic', 'simulation'],
      sensorDataNote: 'Browser readings are simulated and are not physical measurements.',
      reservoir: { ...reservoir },
      recentEvents: this.getEvents().slice(0, 10),
    };
  },

  addZone({ name, locationNote, gridX, gridY, moistureThreshold }) {
    const newId = Math.max(0, ...zones.map((z) => z.id)) + 1;
    const z = createZone({
      id: newId,
      name,
      locationNote,
      gridX,
      gridY,
      threshold: moistureThreshold,
    });
    z.currentMoisture = 15;
    z.storageMm = z.parameters.wiltingPointMm
      + (z.parameters.fieldCapacityMm - z.parameters.wiltingPointMm) * 0.15;
    z.trueMoisture = 0.15;
    zones.push(z);
    notify();
    return toApiZone(z);
  },

  deleteZone(zoneId) {
    zones = zones.filter((z) => z.id !== zoneId);
    notify();
  },

  manualWater(zoneId) {
    const z = zones.find((z) => z.id === zoneId);
    if (!z) return;
    manualWater(z, { reservoir });
    notify();
  },
};
