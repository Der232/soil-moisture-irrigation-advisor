const { getRecentEvents } = require('../models/irrigationModel');
const { getLatestReadings } = require('../models/readingModel');
const { requestIrrigation } = require('../utils/irrigationAdvisor');

async function recentEvents(req, res) {
  try {
    const events = await getRecentEvents();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch irrigation events', details: err.message });
  }
}

async function manualWater(req, res) {
  try {
    const { zoneId } = req.body;
    if (!zoneId) return res.status(400).json({ error: 'zoneId is required' });

    // Look up the most recent moisture reading for this zone, if any, to use
    // as the starting state for the measurable pump pulse.
    const latest = await getLatestReadings();
    const zoneReading = latest.find((r) => r.zone_id === Number(zoneId));

    const result = await requestIrrigation({
      zoneId,
      triggeredBy: 'manual',
      mode: 'manual',
      moistureBefore: zoneReading ? zoneReading.moisture_percent : null,
      durationSeconds: req.body.durationSeconds,
    });

    if (!result.approved) {
      return res.status(409).json({
        error: 'Manual watering blocked',
        reason: result.reason,
        irrigation: result,
      });
    }
    res.status(201).json({ id: result.id, message: 'Manual watering approved', irrigation: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log manual watering', details: err.message });
  }
}

module.exports = { recentEvents, manualWater };
