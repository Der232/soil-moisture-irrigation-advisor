const db = require('../config/db');

async function getCalibrationForZone(zoneId) {
  const [rows] = await db.query(
    'SELECT * FROM sensor_calibrations WHERE zone_id = ?',
    [zoneId]
  );
  return rows[0] || null;
}

async function saveCalibration({
  zoneId,
  adcBits,
  referenceVoltageV,
  wetRaw,
  dryRaw,
  calibrationNote,
}) {
  await db.query(
    `INSERT INTO sensor_calibrations
      (zone_id, adc_bits, reference_voltage_v, wet_raw, dry_raw, calibration_note)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       adc_bits = VALUES(adc_bits),
       reference_voltage_v = VALUES(reference_voltage_v),
       wet_raw = VALUES(wet_raw),
       dry_raw = VALUES(dry_raw),
       calibration_note = VALUES(calibration_note)`,
    [zoneId, adcBits, referenceVoltageV, wetRaw, dryRaw, calibrationNote || null]
  );
  return getCalibrationForZone(zoneId);
}

module.exports = { getCalibrationForZone, saveCalibration };