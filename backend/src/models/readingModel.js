const db = require('../config/db');

async function addReading({
  zoneId,
  moisturePercent,
  rawAdc = null,
  adcBits = 12,
  sensorVoltageV = null,
  dataSource = 'simulated',
  temperatureC = null,
  relativeHumidityPercent = null,
  rainfallMm = 0,
  windFactor = 1,
  solarFactor = 1,
  sensorStatus = 'ok',
}) {
  const [result] = await db.query(
    `INSERT INTO sensor_readings
      (zone_id, moisture_percent, raw_adc, adc_bits, sensor_voltage_v, data_source,
       temperature_c, relative_humidity_percent, rainfall_mm, wind_factor,
       solar_factor, sensor_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      zoneId, moisturePercent, rawAdc, adcBits, sensorVoltageV, dataSource,
      temperatureC, relativeHumidityPercent, rainfallMm, windFactor, solarFactor,
      sensorStatus,
    ]
  );
  return result.insertId;
}

// Latest reading for every zone (used by the dashboard's live status cards)
async function getLatestReadings() {
  const [rows] = await db.query(`
    SELECT sr.zone_id, sr.moisture_percent, sr.raw_adc, sr.adc_bits,
           sr.sensor_voltage_v, sr.data_source, sr.temperature_c,
           sr.relative_humidity_percent, sr.rainfall_mm, sr.wind_factor,
           sr.solar_factor, sr.sensor_status, sr.recorded_at
    FROM sensor_readings sr
    INNER JOIN (
      SELECT zone_id, MAX(recorded_at) AS max_time
      FROM sensor_readings
      GROUP BY zone_id
    ) latest ON sr.zone_id = latest.zone_id AND sr.recorded_at = latest.max_time
  `);
  return rows;
}

// Reading history for a single zone (used for the chart panel)
async function getHistoryForZone(zoneId, limit = 50) {
  const [rows] = await db.query(
    `SELECT moisture_percent, raw_adc, adc_bits, sensor_voltage_v,
            data_source, temperature_c, relative_humidity_percent,
            rainfall_mm, wind_factor, solar_factor, sensor_status, recorded_at
     FROM sensor_readings
     WHERE zone_id = ? ORDER BY recorded_at DESC LIMIT ?`,
    [zoneId, limit]
  );
  return rows.reverse();
}

module.exports = { addReading, getLatestReadings, getHistoryForZone };
