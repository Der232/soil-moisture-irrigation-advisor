const { body, validationResult } = require('express-validator');

function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

const readingRules = [
  body('zoneId').isInt({ min: 1 }).withMessage('zoneId must be a valid id'),
  body('moisturePercent')
    .isFloat({ min: 0, max: 100 })
    .withMessage('moisturePercent must be a number between 0 and 100'),
  body('rawAdc').optional({ nullable: true }).isInt({ min: 0 })
    .withMessage('rawAdc must be a non-negative integer'),
  body('adcBits').optional().isInt({ min: 8, max: 16 })
    .withMessage('adcBits must be between 8 and 16'),
  body('sensorVoltageV').optional({ nullable: true }).isFloat({ min: 0, max: 10 })
    .withMessage('sensorVoltageV must be between 0 and 10'),
  body('dataSource').optional().isIn(['simulated', 'hardware', 'manual'])
    .withMessage('dataSource is invalid'),
  body('temperatureC').optional({ nullable: true }).isFloat({ min: -50, max: 80 })
    .withMessage('temperatureC must be between -50 and 80'),
  body('relativeHumidityPercent').optional({ nullable: true }).isFloat({ min: 0, max: 100 })
    .withMessage('relativeHumidityPercent must be between 0 and 100'),
  body('rainfallMm').optional().isFloat({ min: 0, max: 1000 })
    .withMessage('rainfallMm must be between 0 and 1000'),
  body('windFactor').optional().isFloat({ min: 0, max: 3 })
    .withMessage('windFactor must be between 0 and 3'),
  body('solarFactor').optional().isFloat({ min: 0, max: 3 })
    .withMessage('solarFactor must be between 0 and 3'),
  body('sensorStatus').optional().isIn(['ok', 'noisy', 'disconnected', 'out_of_range'])
    .withMessage('sensorStatus is invalid'),
];

const zoneRules = [
  body('name').trim().notEmpty().withMessage('name is required'),
  body('locationNote').optional({ nullable: true }).isString().isLength({ max: 200 })
    .withMessage('locationNote must be at most 200 characters'),
  body('gridX').optional().isInt().withMessage('gridX must be an integer'),
  body('gridY').optional().isInt().withMessage('gridY must be an integer'),
  body('moistureThreshold')
    .optional({ checkFalsy: true })
    .isFloat({ min: 0, max: 100 })
    .withMessage('moistureThreshold must be a number between 0 and 100'),
  body('areaM2').optional().isFloat({ min: 0.01, max: 100000 })
    .withMessage('areaM2 must be positive'),
  body('rootZoneDepthMm').optional().isFloat({ min: 1, max: 5000 })
    .withMessage('rootZoneDepthMm must be between 1 and 5000'),
  body('fieldCapacityMm').optional().isFloat({ min: 0, max: 5000 })
    .withMessage('fieldCapacityMm must be between 0 and 5000'),
  body('wiltingPointMm').optional().isFloat({ min: 0, max: 5000 })
    .withMessage('wiltingPointMm must be between 0 and 5000'),
  body('moistureTargetPercent').optional().isFloat({ min: 0, max: 100 })
    .withMessage('moistureTargetPercent must be between 0 and 100'),
  body('upperMoisturePercent').optional().isFloat({ min: 0, max: 100 })
    .withMessage('upperMoisturePercent must be between 0 and 100'),
  body('pumpFlowLpm').optional().isFloat({ min: 0, max: 1000 })
    .withMessage('pumpFlowLpm must be between 0 and 1000'),
  body('irrigationEfficiencyPercent').optional().isFloat({ min: 0, max: 100 })
    .withMessage('irrigationEfficiencyPercent must be between 0 and 100'),
  body('dryingRateFactor').optional().isFloat({ min: 0, max: 20 })
    .withMessage('dryingRateFactor must be between 0 and 20'),
  body('operatingMode').optional().isIn(['manual', 'automatic', 'simulation'])
    .withMessage('operatingMode is invalid'),
];

const manualWaterRules = [
  body('zoneId').isInt({ min: 1 }).withMessage('zoneId must be a valid id'),
  body('durationSeconds').optional().isInt({ min: 1, max: 3600 })
    .withMessage('durationSeconds must be between 1 and 3600'),
];

const calibrationRules = [
  body('adcBits').isInt({ min: 8, max: 16 }).withMessage('adcBits must be between 8 and 16'),
  body('referenceVoltageV').isFloat({ min: 0.1, max: 10 }).withMessage('referenceVoltageV is invalid'),
  body('wetRaw').isInt({ min: 0 }).withMessage('wetRaw must be a non-negative integer'),
  body('dryRaw').isInt({ min: 0 }).withMessage('dryRaw must be a non-negative integer'),
  body('calibrationNote').optional({ nullable: true }).isString().isLength({ max: 255 })
    .withMessage('calibrationNote must be at most 255 characters'),
];

module.exports = {
  handleValidation,
  readingRules,
  zoneRules,
  manualWaterRules,
  calibrationRules,
};
