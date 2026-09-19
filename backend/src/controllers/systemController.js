const { getReservoir, updateReservoir } = require('../models/reservoirModel');
const { getRecentEvents } = require('../models/irrigationModel');

async function getSystemStatus(req, res) {
  try {
    const [reservoir, recentEvents] = await Promise.all([
      getReservoir(),
      getRecentEvents(10),
    ]);
    res.json({
      operatingModes: ['manual', 'automatic', 'simulation'],
      sensorDataNote: 'Readings may be simulated, hardware-reported, or manually entered.',
      reservoir,
      recentEvents,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch system status', details: err.message });
  }
}

async function configureReservoir(req, res) {
  try {
    const { capacityL, currentLevelL, dailyBudgetL } = req.body;
    const reservoir = await updateReservoir({ capacityL, currentLevelL, dailyBudgetL });
    res.json({ message: 'Reservoir configuration updated', reservoir });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update reservoir', details: err.message });
  }
}

module.exports = { getSystemStatus, configureReservoir };