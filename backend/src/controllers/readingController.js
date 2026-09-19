const { addReading, getLatestReadings, getHistoryForZone } = require('../models/readingModel');
const { evaluateZone } = require('../utils/irrigationAdvisor');

// Called by real sensors later, or by the simulator now
async function submitReading(req, res) {
  try {
    const {
      zoneId, moisturePercent, rawAdc, adcBits, sensorVoltageV, dataSource,
      temperatureC, relativeHumidityPercent, rainfallMm, windFactor, solarFactor,
      sensorStatus,
    } = req.body;
    if (zoneId === undefined || moisturePercent === undefined) {
      return res.status(400).json({ error: 'zoneId and moisturePercent are required' });
    }

    const reading = { zoneId, moisturePercent };
    const optionalFields = {
      rawAdc,
      adcBits,
      sensorVoltageV,
      dataSource,
      temperatureC,
      relativeHumidityPercent,
      rainfallMm,
      windFactor,
      solarFactor,
      sensorStatus,
    };
    Object.entries(optionalFields).forEach(([key, value]) => {
      if (value !== undefined) reading[key] = value;
    });
    await addReading(reading);
    const advisorResult = await evaluateZone({ zoneId, moisturePercent });

    res.status(201).json({ message: 'Reading recorded', advisorResult });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record reading', details: err.message });
  }
}

async function latestStatus(req, res) {
  try {
    const readings = await getLatestReadings();
    res.json(readings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch latest readings', details: err.message });
  }
}

async function zoneHistory(req, res) {
  try {
    const history = await getHistoryForZone(req.params.zoneId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch history', details: err.message });
  }
}

module.exports = { submitReading, latestStatus, zoneHistory };
