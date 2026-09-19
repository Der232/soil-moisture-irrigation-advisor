const express = require('express');
const router = express.Router();
const {
  getZoneCalibration,
  updateZoneCalibration,
} = require('../controllers/calibrationController');
const { handleValidation, calibrationRules } = require('../middleware/validation');

router.get('/:zoneId', getZoneCalibration);
router.put('/:zoneId', calibrationRules, handleValidation, updateZoneCalibration);

module.exports = router;