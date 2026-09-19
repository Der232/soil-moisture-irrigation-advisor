const { getZoneById } = require('../models/zoneModel');
const { getCalibrationForZone, saveCalibration } = require('../models/calibrationModel');
const { validateCalibration } = require('../utils/engineeringModel');

async function getZoneCalibration(req, res) {
  try {
    const zone = await getZoneById(req.params.zoneId);
    if (!zone) return res.status(404).json({ error: 'Zone not found' });

    const calibration = await getCalibrationForZone(req.params.zoneId);
    res.json({
      zoneId: Number(req.params.zoneId),
      calibration: calibration || null,
      message: calibration
        ? 'Calibration loaded'
        : 'No calibration saved for this zone',
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch calibration', details: err.message });
  }
}

async function updateZoneCalibration(req, res) {
  try {
    const zone = await getZoneById(req.params.zoneId);
    if (!zone) return res.status(404).json({ error: 'Zone not found' });

    const {
      adcBits = 12,
      referenceVoltageV = 3.3,
      wetRaw,
      dryRaw,
      calibrationNote,
    } = req.body;
    const validation = validateCalibration({ adcBits, referenceVoltageV, wetRaw, dryRaw });
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid calibration',
        details: validation.errors,
      });
    }

    const calibration = await saveCalibration({
      zoneId: req.params.zoneId,
      adcBits: validation.adcBits,
      referenceVoltageV: validation.referenceVoltageV,
      wetRaw: validation.wetRaw,
      dryRaw: validation.dryRaw,
      calibrationNote,
    });
    res.status(200).json({ message: 'Calibration saved', calibration });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save calibration', details: err.message });
  }
}

module.exports = { getZoneCalibration, updateZoneCalibration };