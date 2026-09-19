/**
 * Explainable engineering calculations used by the simulation and API layer.
 *
 * The model uses millimetres of water over a zone area:
 *   storage_next = storage_previous + irrigation + rainfall
 *                  - evapotranspiration - drainage
 *
 * A zone's displayed moisture percentage is a relative root-zone storage
 * estimate between its wilting point and field capacity. It is deliberately
 * not labelled volumetric water content because that would require soil-
 * specific laboratory calibration.
 */

const DEFAULT_ZONE_PARAMETERS = Object.freeze({
  areaM2: 10,
  rootZoneDepthMm: 300,
  fieldCapacityMm: 150,
  wiltingPointMm: 45,
  moistureTargetPercent: 65,
  upperMoisturePercent: 75,
  pumpFlowLpm: 2,
  irrigationEfficiencyPercent: 75,
  dryingRateFactor: 1,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeZoneParameters(input = {}) {
  const parameters = { ...DEFAULT_ZONE_PARAMETERS, ...input };
  const fieldCapacityMm = Math.max(0, finiteNumber(parameters.fieldCapacityMm, DEFAULT_ZONE_PARAMETERS.fieldCapacityMm));
  const wiltingPointMm = clamp(
    finiteNumber(parameters.wiltingPointMm, DEFAULT_ZONE_PARAMETERS.wiltingPointMm),
    0,
    fieldCapacityMm
  );

  return {
    ...parameters,
    areaM2: Math.max(0.01, finiteNumber(parameters.areaM2, DEFAULT_ZONE_PARAMETERS.areaM2)),
    rootZoneDepthMm: Math.max(1, finiteNumber(parameters.rootZoneDepthMm, DEFAULT_ZONE_PARAMETERS.rootZoneDepthMm)),
    fieldCapacityMm,
    wiltingPointMm,
    moistureTargetPercent: clamp(finiteNumber(parameters.moistureTargetPercent, 65), 0, 100),
    upperMoisturePercent: clamp(finiteNumber(parameters.upperMoisturePercent, 75), 0, 100),
    pumpFlowLpm: Math.max(0, finiteNumber(parameters.pumpFlowLpm, 2)),
    irrigationEfficiencyPercent: clamp(finiteNumber(parameters.irrigationEfficiencyPercent, 75), 0, 100),
    dryingRateFactor: Math.max(0, finiteNumber(parameters.dryingRateFactor, 1)),
  };
}

function validateCalibration({ wetRaw, dryRaw, adcBits = 12, referenceVoltageV = 3.3 } = {}) {
  const bits = Number(adcBits);
  const wet = Number(wetRaw);
  const dry = Number(dryRaw);
  const referenceVoltage = Number(referenceVoltageV);
  const maxRaw = Number.isInteger(bits) && bits >= 8 && bits <= 16 ? (2 ** bits) - 1 : null;

  const errors = [];
  if (!maxRaw) errors.push('adcBits must be an integer from 8 to 16');
  if (!Number.isFinite(referenceVoltage) || referenceVoltage <= 0) {
    errors.push('referenceVoltageV must be greater than zero');
  }
  if (!Number.isFinite(wet) || !Number.isFinite(dry) || wet === dry) {
    errors.push('wetRaw and dryRaw must be different finite values');
  }
  if (maxRaw && (wet < 0 || wet > maxRaw || dry < 0 || dry > maxRaw)) {
    errors.push(`wetRaw and dryRaw must be within 0-${maxRaw}`);
  }

  return {
    valid: errors.length === 0,
    errors,
    adcBits: bits,
    maxRaw,
    wetRaw: wet,
    dryRaw: dry,
    referenceVoltageV: referenceVoltage,
    orientation: wet < dry ? 'raw-increases-when-dry' : 'raw-decreases-when-dry',
  };
}

function rawToMoisturePercent(rawValue, calibration) {
  const checked = validateCalibration(calibration);
  if (!checked.valid) {
    throw new Error(checked.errors.join('; '));
  }

  const raw = clamp(Number(rawValue), 0, checked.maxRaw);
  const percent = ((raw - checked.dryRaw) / (checked.wetRaw - checked.dryRaw)) * 100;
  return clamp(percent, 0, 100);
}

function rawToVoltage(rawValue, adcBits = 12, referenceVoltageV = 3.3) {
  const maxRaw = (2 ** Number(adcBits)) - 1;
  if (!Number.isFinite(maxRaw) || maxRaw <= 0) {
    throw new Error('adcBits must define a positive ADC range');
  }
  return clamp(Number(rawValue), 0, maxRaw) / maxRaw * Number(referenceVoltageV);
}

function moisturePercentToStorage(moisturePercent, parameters = {}) {
  const zone = normalizeZoneParameters(parameters);
  const fraction = clamp(Number(moisturePercent), 0, 100) / 100;
  return zone.wiltingPointMm + fraction * (zone.fieldCapacityMm - zone.wiltingPointMm);
}

function storageToMoisturePercent(storageMm, parameters = {}) {
  const zone = normalizeZoneParameters(parameters);
  const range = zone.fieldCapacityMm - zone.wiltingPointMm;
  if (range <= 0) return 0;
  return clamp((Number(storageMm) - zone.wiltingPointMm) / range * 100, 0, 100);
}

/**
 * A transparent ET proxy for a demonstration model, not a weather service.
 * The coefficient is intentionally configurable and should be calibrated
 * against local observations before being used for physical irrigation.
 */
function estimateEvapotranspirationMm({
  temperatureC = 25,
  relativeHumidityPercent = 50,
  windFactor = 1,
  solarFactor = 1,
  daylightFactor = 1,
  dryingRateFactor = 1,
} = {}) {
  const temperatureEffect = Math.max(0, Number(temperatureC) - 5) / 20;
  const humidityEffect = 1 - clamp(Number(relativeHumidityPercent), 0, 100) / 100 * 0.6;
  const environmentEffect =
    clamp(Number(windFactor), 0, 3) *
    clamp(Number(solarFactor), 0, 3) *
    clamp(Number(daylightFactor), 0, 1.5);

  return Math.max(
    0,
    0.35 * temperatureEffect * humidityEffect * environmentEffect * Math.max(0, Number(dryingRateFactor))
  );
}

function calculateIrrigationVolume({ flowRateLpm, durationSeconds, efficiencyPercent = 75, areaM2 }) {
  const requestedVolumeL = Math.max(0, Number(flowRateLpm) * Math.max(0, Number(durationSeconds)) / 60);
  const deliveredVolumeL = requestedVolumeL;
  const retainedVolumeL = deliveredVolumeL * clamp(Number(efficiencyPercent), 0, 100) / 100;
  const retainedDepthMm = retainedVolumeL / Math.max(0.01, Number(areaM2));
  return { requestedVolumeL, deliveredVolumeL, retainedVolumeL, retainedDepthMm };
}

function waterBalanceStep({
  previousStorageMm,
  irrigationMm = 0,
  rainfallMm = 0,
  evapotranspirationMm = 0,
  fieldCapacityMm,
  drainageFraction = 1,
} = {}) {
  const capacity = Math.max(0, Number(fieldCapacityMm));
  const beforeDrainage = Math.max(
    0,
    Number(previousStorageMm) + Math.max(0, Number(irrigationMm)) + Math.max(0, Number(rainfallMm))
      - Math.max(0, Number(evapotranspirationMm))
  );
  const excessMm = Math.max(0, beforeDrainage - capacity);
  const drainageMm = excessMm * clamp(Number(drainageFraction), 0, 1);
  const storageMm = clamp(beforeDrainage - drainageMm, 0, capacity);

  return {
    storageMm,
    drainageMm,
    deficitMm: Math.max(0, capacity - storageMm),
  };
}

module.exports = {
  DEFAULT_ZONE_PARAMETERS,
  clamp,
  normalizeZoneParameters,
  validateCalibration,
  rawToMoisturePercent,
  rawToVoltage,
  moisturePercentToStorage,
  storageToMoisturePercent,
  estimateEvapotranspirationMm,
  calculateIrrigationVolume,
  waterBalanceStep,
};