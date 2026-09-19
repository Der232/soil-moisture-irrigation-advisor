const express = require('express');
const router = express.Router();
const { getSystemStatus, configureReservoir } = require('../controllers/systemController');
const { handleValidation, reservoirRules } = require('../middleware/validation');

router.get('/status', getSystemStatus);
router.put('/reservoir', reservoirRules, handleValidation, configureReservoir);

module.exports = router;