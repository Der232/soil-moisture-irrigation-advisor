/**
 * Browser irrigation simulation.
 *
 * The browser demo intentionally uses the same explainable model as the
 * backend:
 *
 *   storage_next = storage_previous + retained irrigation + rainfall
 *                  - evapotranspiration - drainage
 *
 * Storage is millimetres of water over the zone. One millimetre over one
 * square metre equals one litre. The displayed percentage is a relative
 * position between wilting point and field capacity; it is not volumetric
 * water content.
 */

export const ADC_BITS = 12;
export const ADC_MAX = (2 ** ADC_BITS) - 1;

export const DEFAULT_CALIBRATION = Object.freeze({
  wetRaw: 1200,
  dryRaw: 3000,
  adcBits: ADC_BITS,
  referenceVoltageV: 3.3,
});

export const DEFAULT_ZONE_PARAMETERS = Object.freeze({
  areaM2: 10,
  soilType: 'loam',
  rootZoneDepthMm: 300,
  fieldCapacityMm: 150,
  wiltingPointMm: 45,
  moistureTargetPercent: 65,
  upperMoisturePercent: 75,
  pumpFlowLpm: 2,
  irrigationEfficiencyPercent: 75,
  dryingRateFactor: 1,
  operatingMode: 'simulation',
});

export const DEFAULT_RESERVOIR = Object.freeze({
  capacityL: 500,
  currentLevelL: 500,
  dailyBudgetL: 100,
  dailyUsedL: 0,
});

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function numberOr(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function hashSeed(value) {
  let hash = 2166136261;
  for (const character of String(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0);
}

function deterministicNoise(seed, tick) {
  const value = Math.sin((seed + 1) * 12.9898 + (tick + 1) * 78.233) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

function normalizeParameters(input = {}) {
  const parameters = { ...DEFAULT_ZONE_PARAMETERS, ...input };
  const fieldCapacityMm = Math.max(0, numberOr(parameters.fieldCapacityMm, 150));
  const wiltingPointMm = clamp(numberOr(parameters.wiltingPointMm, 45), 0, fieldCapacityMm);
  return {
    ...parameters,
    areaM2: Math.max(0.01, numberOr(parameters.areaM2, 10)),
    rootZoneDepthMm: Math.max(1, numberOr(parameters.rootZoneDepthMm, 300)),
    fieldCapacityMm,
    wiltingPointMm,
    moistureTargetPercent: clamp(numberOr(parameters.moistureTargetPercent, 65), 0, 100),
    upperMoisturePercent: clamp(numberOr(parameters.upperMoisturePercent, 75), 0, 100),
    pumpFlowLpm: Math.max(0, numberOr(parameters.pumpFlowLpm, 2)),
    irrigationEfficiencyPercent: clamp(numberOr(parameters.irrigationEfficiencyPercent, 75), 0, 100),
    dryingRateFactor: Math.max(0, numberOr(parameters.dryingRateFactor, 1)),
  };
}

export function rawToPercent(rawValue, calibration = DEFAULT_CALIBRATION) {
  const wetRaw = numberOr(calibration.wetRaw, DEFAULT_CALIBRATION.wetRaw);
  const dryRaw = numberOr(calibration.dryRaw, DEFAULT_CALIBRATION.dryRaw);
  if (wetRaw === dryRaw) return 0;
  const maxRaw = (2 ** numberOr(calibration.adcBits, ADC_BITS)) - 1;
  const raw = clamp(numberOr(rawValue, dryRaw), 0, maxRaw);
  return clamp(((raw - dryRaw) / (wetRaw - dryRaw)) * 100, 0, 100);
}

export function rawToVoltage(rawValue, calibration = DEFAULT_CALIBRATION) {
  const maxRaw = (2 ** numberOr(calibration.adcBits, ADC_BITS)) - 1;
  return clamp(numberOr(rawValue, 0), 0, maxRaw) / maxRaw
    * numberOr(calibration.referenceVoltageV, 3.3);
}

export function moisturePercentToStorage(moisturePercent, parameters = {}) {
  const zone = normalizeParameters(parameters);
  const fraction = clamp(numberOr(moisturePercent, 0), 0, 100) / 100;
  return zone.wiltingPointMm + fraction * (zone.fieldCapacityMm - zone.wiltingPointMm);
}

export function storageToMoisturePercent(storageMm, parameters = {}) {
  const zone = normalizeParameters(parameters);
  const range = zone.fieldCapacityMm - zone.wiltingPointMm;
  if (range <= 0) return 0;
  return clamp((numberOr(storageMm, 0) - zone.wiltingPointMm) / range * 100, 0, 100);
}

export function estimateEvapotranspirationMm({
  temperatureC = 25,
  relativeHumidityPercent = 50,
  windFactor = 1,
  solarFactor = 1,
  daylightFactor = 1,
  dryingRateFactor = 1,
  elapsedHours = 1,
} = {}) {
  const temperatureEffect = Math.max(0, numberOr(temperatureC, 25) - 5) / 20;
  const humidityEffect = 1 - clamp(numberOr(relativeHumidityPercent, 50), 0, 100) / 100 * 0.6;
  const environmentEffect =
    clamp(numberOr(windFactor, 1), 0, 3)
    * clamp(numberOr(solarFactor, 1), 0, 3)
    * clamp(numberOr(daylightFactor, 1), 0, 1.5);
  return Math.max(
    0,
    0.35 * temperatureEffect * humidityEffect * environmentEffect
      * Math.max(0, numberOr(dryingRateFactor, 1))
      * Math.max(0, numberOr(elapsedHours, 1))
  );
}

export function calculateIrrigationVolume({
  flowRateLpm,
  durationSeconds,
  efficiencyPercent = 75,
  areaM2,
} = {}) {
  const requestedVolumeL = Math.max(0, numberOr(flowRateLpm, 0))
    * Math.max(0, numberOr(durationSeconds, 0)) / 60;
  const deliveredVolumeL = requestedVolumeL;
  const retainedVolumeL = deliveredVolumeL * clamp(numberOr(efficiencyPercent, 75), 0, 100) / 100;
  return {
    requestedVolumeL,
    deliveredVolumeL,
    retainedVolumeL,
    retainedDepthMm: retainedVolumeL / Math.max(0.01, numberOr(areaM2, 1)),
  };
}

export function waterBalanceStep({
  previousStorageMm,
  irrigationMm = 0,
  rainfallMm = 0,
  evapotranspirationMm = 0,
  fieldCapacityMm,
  drainageFraction = 1,
} = {}) {
  const capacity = Math.max(0, numberOr(fieldCapacityMm, 0));
  const beforeDrainage = Math.max(
    0,
    numberOr(previousStorageMm, 0)
      + Math.max(0, numberOr(irrigationMm, 0))
      + Math.max(0, numberOr(rainfallMm, 0))
      - Math.max(0, numberOr(evapotranspirationMm, 0))
  );
  const excessMm = Math.max(0, beforeDrainage - capacity);
  const drainageMm = excessMm * clamp(numberOr(drainageFraction, 1), 0, 1);
  const storageMm = clamp(beforeDrainage - drainageMm, 0, capacity);
  return {
    storageMm,
    drainageMm,
    deficitMm: Math.max(0, capacity - storageMm),
  };
}

export function createReservoir(overrides = {}) {
  return {
    ...DEFAULT_RESERVOIR,
    ...overrides,
    capacityL: Math.max(0, numberOr(overrides.capacityL, DEFAULT_RESERVOIR.capacityL)),
    currentLevelL: clamp(
      numberOr(overrides.currentLevelL, DEFAULT_RESERVOIR.currentLevelL),
      0,
      Math.max(0, numberOr(overrides.capacityL, DEFAULT_RESERVOIR.capacityL))
    ),
    dailyBudgetL: Math.max(0, numberOr(overrides.dailyBudgetL, DEFAULT_RESERVOIR.dailyBudgetL)),
    dailyUsedL: Math.max(0, numberOr(overrides.dailyUsedL, DEFAULT_RESERVOIR.dailyUsedL)),
  };
}

function reserveWater(reservoir, requestedVolumeL, nowMs) {
  const requested = Math.max(0, numberOr(requestedVolumeL, 0));
  if (!reservoir) return { approved: true, requestedVolumeL: requested };

  const budgetDate = new Date(nowMs).toISOString().slice(0, 10);
  if (reservoir.budgetDate !== budgetDate) {
    reservoir.dailyUsedL = 0;
    reservoir.budgetDate = budgetDate;
  }
  if (reservoir.currentLevelL < requested) {
    return {
      approved: false,
      reason: 'Insufficient reservoir water',
      availableVolumeL: reservoir.currentLevelL,
      requestedVolumeL: requested,
    };
  }
  if (reservoir.dailyUsedL + requested > reservoir.dailyBudgetL) {
    return {
      approved: false,
      reason: 'Daily water budget exceeded',
      remainingBudgetL: Math.max(0, reservoir.dailyBudgetL - reservoir.dailyUsedL),
      requestedVolumeL: requested,
    };
  }
  reservoir.currentLevelL -= requested;
  reservoir.dailyUsedL += requested;
  return {
    approved: true,
    requestedVolumeL: requested,
    remainingVolumeL: reservoir.currentLevelL,
    remainingBudgetL: Math.max(0, reservoir.dailyBudgetL - reservoir.dailyUsedL),
  };
}

function buildPulse(zone, moisturePercent, durationSeconds) {
  const parameters = zone.parameters;
  const threshold = zone.moistureThreshold;
  const targetPercent = Math.max(
    threshold,
    Math.min(parameters.upperMoisturePercent, parameters.moistureTargetPercent)
  );
  const currentStorageMm = moisturePercentToStorage(moisturePercent, parameters);
  const targetStorageMm = moisturePercentToStorage(targetPercent, parameters);
  const targetRetainedVolumeL = Math.max(0, targetStorageMm - currentStorageMm) * parameters.areaM2;
  const targetDeliveredVolumeL = targetRetainedVolumeL
    / Math.max(0.01, parameters.irrigationEfficiencyPercent / 100);
  const targetDurationSeconds = targetDeliveredVolumeL
    / Math.max(0.001, parameters.pumpFlowLpm) * 60;
  const seconds = Math.min(
    300,
    Math.max(
      1,
      Number.isFinite(Number(durationSeconds))
        ? Number(durationSeconds)
        : Math.ceil(Math.max(30, targetDurationSeconds))
    )
  );
  return {
    targetPercent,
    durationSeconds: seconds,
    ...calculateIrrigationVolume({
      flowRateLpm: parameters.pumpFlowLpm,
      durationSeconds: seconds,
      efficiencyPercent: parameters.irrigationEfficiencyPercent,
      areaM2: parameters.areaM2,
    }),
  };
}

function addEvent(zone, event) {
  zone.events.unshift({
    id: `${zone.id}-${zone.events.length + 1}`,
    zoneId: zone.id,
    zoneName: zone.name,
    timestamp: event.timestamp,
    ...event,
  });
  if (zone.events.length > 50) zone.events.pop();
}

function updateSensorReading(zone, tickNumber) {
  const trueRaw = zone.calibration.dryRaw
    + (zone.calibration.wetRaw - zone.calibration.dryRaw) * zone.trueMoisture;
  const noise = zone.sensorFailure === 'disconnected'
    ? null
    : deterministicNoise(zone.seed, tickNumber) * zone.sensorNoiseRaw;
  if (noise === null) {
    zone.sensorStatus = 'disconnected';
    zone.currentMoisture = null;
    zone.rawValue = null;
    return null;
  }
  const measuredRaw = clamp(trueRaw + noise, 0, ADC_MAX);
  zone.sensorStatus = Math.abs(noise) > zone.sensorNoiseRaw * 0.8 ? 'noisy' : 'ok';
  zone.rawValue = measuredRaw;
  zone.currentMoisture = Number(rawToPercent(measuredRaw, zone.calibration).toFixed(2));
  return {
    rawAdc: Math.round(measuredRaw),
    sensorVoltageV: Number(rawToVoltage(measuredRaw, zone.calibration).toFixed(3)),
    moisturePercent: zone.currentMoisture,
    sensorStatus: zone.sensorStatus,
  };
}

function currentDaylightFactor(simulatedAtMs, simulatedDayMinutes) {
  const cycleMs = Math.max(1, simulatedDayMinutes * 60 * 1000);
  const phase = ((simulatedAtMs % cycleMs) + cycleMs) % cycleMs / cycleMs;
  return clamp(0.5 + 0.5 * Math.sin(phase * Math.PI * 2 - Math.PI / 2), 0, 1);
}

function updateZoneStorage(zone, {
  elapsedMinutes,
  simulatedAtMs,
  simulatedDayMinutes,
  rainfallMm,
  environment,
}) {
  const daylightFactor = currentDaylightFactor(simulatedAtMs, simulatedDayMinutes);
  const evapotranspirationMm = estimateEvapotranspirationMm({
    temperatureC: environment.temperatureC,
    relativeHumidityPercent: environment.relativeHumidityPercent,
    windFactor: environment.windFactor,
    solarFactor: environment.solarFactor,
    daylightFactor,
    dryingRateFactor: zone.parameters.dryingRateFactor,
    elapsedHours: elapsedMinutes / 60,
  });
  const balance = waterBalanceStep({
    previousStorageMm: zone.storageMm,
    rainfallMm,
    evapotranspirationMm,
    fieldCapacityMm: zone.parameters.fieldCapacityMm,
  });
  zone.storageMm = balance.storageMm;
  zone.trueMoisture = storageToMoisturePercent(zone.storageMm, zone.parameters) / 100;
  zone.lastBalance = {
    rainfallMm,
    evapotranspirationMm,
    drainageMm: balance.drainageMm,
    storageMm: zone.storageMm,
  };
  return balance;
}

function attemptIrrigation(zone, moisturePercent, {
  nowMs,
  reservoir,
  mode,
  durationSeconds,
  pumpFailure,
}) {
  if (moisturePercent === null) {
    return { watered: false, blocked: true, reason: 'Sensor disconnected' };
  }
  if (mode === 'automatic' && zone.operatingMode === 'manual') {
    return { watered: false, blocked: true, reason: 'Zone is in manual mode' };
  }
  if (moisturePercent >= zone.moistureThreshold) {
    return { watered: false };
  }
  if (zone.lastEventTime !== null
    && (nowMs - zone.lastEventTime) / 60000 < zone.cooldownMinutes) {
    return { watered: false, withinCooldown: true };
  }

  const pulse = buildPulse(zone, moisturePercent, durationSeconds);
  if (pumpFailure) {
    return { watered: false, blocked: true, reason: 'Pump failure simulated', pulse };
  }
  const reservation = reserveWater(reservoir, pulse.requestedVolumeL, nowMs);
  if (!reservation.approved) {
    addEvent(zone, {
      triggeredBy: 'auto',
      mode,
      status: 'blocked',
      reason: reservation.reason,
      moistureBefore: moisturePercent,
      timestamp: nowMs,
      ...pulse,
    });
    return { watered: false, blocked: true, reason: reservation.reason, pulse, reservation };
  }

  const balance = waterBalanceStep({
    previousStorageMm: zone.storageMm,
    irrigationMm: pulse.retainedDepthMm,
    fieldCapacityMm: zone.parameters.fieldCapacityMm,
  });
  zone.storageMm = balance.storageMm;
  zone.trueMoisture = storageToMoisturePercent(zone.storageMm, zone.parameters) / 100;
  zone.lastEventTime = nowMs;
  addEvent(zone, {
    triggeredBy: 'auto',
    mode,
    status: 'completed',
    reason: 'Moisture below lower threshold',
    moistureBefore: moisturePercent,
    timestamp: nowMs,
    drainageVolumeL: balance.drainageMm * zone.parameters.areaM2,
    ...pulse,
  });
  return { watered: true, pulse, reservation, balance };
}

export function createZone({
  id,
  name,
  locationNote,
  gridX,
  gridY,
  threshold = 30,
  initialMoisturePercent,
  seed = 42,
  startTimeMs = Date.now(),
  ...parameterOverrides
}) {
  const zoneSeed = hashSeed(`${seed}:${id}:${name}`);
  const parameters = normalizeParameters(parameterOverrides);
  const initialPercent = clamp(
    numberOr(initialMoisturePercent, 38 + (zoneSeed % 18)),
    0,
    100
  );
  return {
    id,
    name,
    locationNote: locationNote || '',
    gridX: gridX ?? 0,
    gridY: gridY ?? 0,
    moistureThreshold: clamp(numberOr(threshold, 30), 0, 100),
    calibration: {
      ...DEFAULT_CALIBRATION,
      wetRaw: 1100 + zoneSeed % 200,
      dryRaw: 2850 + zoneSeed % 300,
    },
    parameters,
    operatingMode: parameters.operatingMode,
    storageMm: moisturePercentToStorage(initialPercent, parameters),
    trueMoisture: initialPercent / 100,
    rawValue: null,
    currentMoisture: initialPercent,
    sensorNoiseRaw: 12,
    sensorFailure: null,
    sensorStatus: 'ok',
    seed: zoneSeed,
    tickNumber: 0,
    simulatedAtMs: startTimeMs,
    cooldownMinutes: 10,
    lastEventTime: null,
    lastBalance: { rainfallMm: 0, evapotranspirationMm: 0, drainageMm: 0, storageMm: 0 },
    events: [],
    history: [],
  };
}

export function createDefaultZones(options = {}) {
  const shared = {
    seed: options.seed ?? 42,
    startTimeMs: options.startTimeMs ?? Date.now(),
  };
  return [
    createZone({ ...shared, id: 1, name: 'Zone A — Tomato bed', locationNote: 'South greenhouse', gridX: 0, gridY: 0, threshold: 30, initialMoisturePercent: 44 }),
    createZone({ ...shared, id: 2, name: 'Zone B — Herb garden', locationNote: 'Near entrance', gridX: 1, gridY: 0, threshold: 35, initialMoisturePercent: 40, dryingRateFactor: 1.2 }),
    createZone({ ...shared, id: 3, name: 'Zone C — Lawn strip', locationNote: 'East wall', gridX: 0, gridY: 1, threshold: 25, initialMoisturePercent: 48, dryingRateFactor: 0.8 }),
    createZone({ ...shared, id: 4, name: 'Zone D — Pepper plot', locationNote: 'North corner', gridX: 1, gridY: 1, threshold: 30, initialMoisturePercent: 42, dryingRateFactor: 1.1 }),
  ];
}

export function tickSimulation(zones, {
  cooldownMinutes = 10,
  simulatedDayMinutes = 10,
  elapsedMinutes = 15,
  nowMs,
  reservoir,
  rainfallMm = 0,
  environment = {},
  pumpFailure = false,
  sensorFailures = {},
} = {}) {
  if (!zones.length) return [];
  const previousTime = Math.max(...zones.map((zone) => zone.simulatedAtMs || 0));
  const tickTime = nowMs ?? previousTime + elapsedMinutes * 60 * 1000;
  const conditions = {
    temperatureC: 25,
    relativeHumidityPercent: 50,
    windFactor: 1,
    solarFactor: 1,
    ...environment,
  };
  return zones.map((zone) => {
    zone.cooldownMinutes = cooldownMinutes;
    zone.simulatedAtMs = tickTime;
    zone.tickNumber += 1;
    if (Object.prototype.hasOwnProperty.call(sensorFailures, zone.id)) {
      zone.sensorFailure = sensorFailures[zone.id] || null;
    }
    updateZoneStorage(zone, {
      elapsedMinutes,
      simulatedAtMs: tickTime,
      simulatedDayMinutes,
      rainfallMm: Math.max(0, numberOr(rainfallMm, 0)),
      environment: conditions,
    });
    const reading = updateSensorReading(zone, zone.tickNumber);
    const moisturePercent = reading ? reading.moisturePercent : null;
    const advisorResult = attemptIrrigation(zone, moisturePercent, {
      nowMs: tickTime,
      reservoir,
      mode: zone.operatingMode === 'manual' ? 'manual' : 'automatic',
      pumpFailure,
    });
    if (advisorResult.watered) {
      const postWaterReading = updateSensorReading(zone, zone.tickNumber + 10000);
      if (postWaterReading) Object.assign(reading, postWaterReading);
    }
    zone.history.push({
      timestamp: tickTime,
      moisture: zone.currentMoisture,
      trueMoisture: Number((zone.trueMoisture * 100).toFixed(2)),
      storageMm: Number(zone.storageMm.toFixed(3)),
      rainfallMm: zone.lastBalance.rainfallMm,
      evapotranspirationMm: zone.lastBalance.evapotranspirationMm,
      drainageMm: zone.lastBalance.drainageMm,
      irrigationActive: Boolean(advisorResult.watered),
    });
    if (zone.history.length > 120) zone.history.shift();
    return {
      zoneId: zone.id,
      reading,
      moisturePercent,
      advisorResult,
      balance: zone.lastBalance,
    };
  });
}

export function manualWater(zone, {
  durationSeconds = 30,
  nowMs = zone.simulatedAtMs ?? Date.now(),
  reservoir,
  pumpFailure = false,
} = {}) {
  const moistureBefore = zone.currentMoisture;
  const pulse = buildPulse(zone, moistureBefore ?? 0, durationSeconds);
  if (pumpFailure) {
    const result = { watered: false, blocked: true, reason: 'Pump failure simulated', pulse };
    addEvent(zone, { ...result, triggeredBy: 'manual', mode: 'manual', status: 'failed', moistureBefore, timestamp: nowMs });
    return result;
  }
  const reservation = reserveWater(reservoir, pulse.requestedVolumeL, nowMs);
  if (!reservation.approved) {
    const result = { watered: false, blocked: true, reason: reservation.reason, pulse, reservation };
    addEvent(zone, { ...result, triggeredBy: 'manual', mode: 'manual', status: 'blocked', moistureBefore, timestamp: nowMs });
    return result;
  }
  const balance = waterBalanceStep({
    previousStorageMm: zone.storageMm,
    irrigationMm: pulse.retainedDepthMm,
    fieldCapacityMm: zone.parameters.fieldCapacityMm,
  });
  zone.storageMm = balance.storageMm;
  zone.trueMoisture = storageToMoisturePercent(zone.storageMm, zone.parameters) / 100;
  zone.currentMoisture = Number((zone.trueMoisture * 100).toFixed(2));
  zone.lastEventTime = nowMs;
  zone.simulatedAtMs = nowMs;
  const result = { watered: true, pulse, reservation, balance };
  addEvent(zone, {
    ...result,
    triggeredBy: 'manual',
    mode: 'manual',
    status: 'completed',
    reason: 'Manual watering request',
    moistureBefore,
    timestamp: nowMs,
  });
  return result;
}