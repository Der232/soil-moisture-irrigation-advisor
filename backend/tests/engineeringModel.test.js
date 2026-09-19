const {
  validateCalibration,
  rawToMoisturePercent,
  rawToVoltage,
  estimateEvapotranspirationMm,
  calculateIrrigationVolume,
  waterBalanceStep,
  moisturePercentToStorage,
  storageToMoisturePercent,
} = require('../src/utils/engineeringModel');

describe('engineering model', () => {
  it('maps a normal increasing-dry calibration to relative moisture', () => {
    const calibration = { wetRaw: 1200, dryRaw: 3000, adcBits: 12 };

    expect(rawToMoisturePercent(1200, calibration)).toBeCloseTo(100);
    expect(rawToMoisturePercent(2100, calibration)).toBeCloseTo(50);
    expect(rawToMoisturePercent(3000, calibration)).toBeCloseTo(0);
  });

  it('supports sensors whose raw orientation is reversed', () => {
    const calibration = { wetRaw: 3000, dryRaw: 1200, adcBits: 12 };

    expect(validateCalibration(calibration).orientation).toBe('raw-decreases-when-dry');
    expect(rawToMoisturePercent(3000, calibration)).toBeCloseTo(100);
    expect(rawToMoisturePercent(1200, calibration)).toBeCloseTo(0);
  });

  it('rejects invalid or identical calibration endpoints', () => {
    const result = validateCalibration({ wetRaw: 100, dryRaw: 100, adcBits: 12 });
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(expect.arrayContaining([
      'wetRaw and dryRaw must be different finite values',
    ]));
  });

  it('converts ADC values to voltage using the selected resolution', () => {
    expect(rawToVoltage(2047.5, 12, 3.3)).toBeCloseTo(1.65, 2);
  });

  it('calculates a positive but bounded evapotranspiration proxy', () => {
    const hotDry = estimateEvapotranspirationMm({
      temperatureC: 35,
      relativeHumidityPercent: 20,
      windFactor: 1.2,
      solarFactor: 1.1,
      daylightFactor: 1,
      dryingRateFactor: 1,
    });
    const coolHumid = estimateEvapotranspirationMm({
      temperatureC: 15,
      relativeHumidityPercent: 90,
      windFactor: 0.5,
      solarFactor: 0.5,
      daylightFactor: 0.5,
      dryingRateFactor: 1,
    });

    expect(hotDry).toBeGreaterThan(coolHumid);
    expect(coolHumid).toBeGreaterThanOrEqual(0);
  });

  it('keeps water balance within field capacity and reports drainage', () => {
    const result = waterBalanceStep({
      previousStorageMm: 140,
      irrigationMm: 30,
      rainfallMm: 10,
      evapotranspirationMm: 5,
      fieldCapacityMm: 150,
    });

    expect(result.storageMm).toBe(150);
    expect(result.drainageMm).toBe(25);
    expect(result.deficitMm).toBe(0);
  });

  it('distinguishes pump delivery from root-zone retention', () => {
    const volume = calculateIrrigationVolume({
      flowRateLpm: 2,
      durationSeconds: 30,
      efficiencyPercent: 75,
      areaM2: 10,
    });

    expect(volume.requestedVolumeL).toBe(1);
    expect(volume.deliveredVolumeL).toBe(1);
    expect(volume.retainedVolumeL).toBe(0.75);
    expect(volume.retainedDepthMm).toBe(0.075);
  });

  it('round-trips relative moisture and root-zone storage', () => {
    const parameters = { wiltingPointMm: 45, fieldCapacityMm: 150 };
    const storage = moisturePercentToStorage(65, parameters);

    expect(storage).toBe(112.5);
    expect(storageToMoisturePercent(storage, parameters)).toBeCloseTo(65);
  });
});