const db = require('../config/db');

async function getAllZones() {
  const [rows] = await db.query(
    `SELECT gz.*, sc.adc_bits, sc.reference_voltage_v, sc.wet_raw, sc.dry_raw,
            sc.calibrated_at
     FROM garden_zones gz
     LEFT JOIN sensor_calibrations sc ON sc.zone_id = gz.id
     ORDER BY gz.id ASC`
  );
  return rows;
}

async function getZoneById(id) {
  const [rows] = await db.query(
    `SELECT gz.*, sc.adc_bits, sc.reference_voltage_v, sc.wet_raw, sc.dry_raw,
            sc.calibrated_at
     FROM garden_zones gz
     LEFT JOIN sensor_calibrations sc ON sc.zone_id = gz.id
     WHERE gz.id = ?`,
    [id]
  );
  return rows[0] || null;
}

async function createZone({
  name,
  locationNote,
  gridX,
  gridY,
  moistureThreshold,
  areaM2,
  soilType,
  rootZoneDepthMm,
  fieldCapacityMm,
  wiltingPointMm,
  moistureTargetPercent,
  upperMoisturePercent,
  pumpFlowLpm,
  irrigationEfficiencyPercent,
  dryingRateFactor,
  operatingMode,
}) {
  const [result] = await db.query(
    `INSERT INTO garden_zones
      (name, location_note, grid_x, grid_y, moisture_threshold, area_m2,
       soil_type, root_zone_depth_mm, field_capacity_mm, wilting_point_mm,
       moisture_target_percent, upper_moisture_percent, pump_flow_lpm,
       irrigation_efficiency_percent, drying_rate_factor, operating_mode)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      name, locationNote || null, gridX ?? 0, gridY ?? 0, moistureThreshold ?? 30,
      areaM2 ?? 10, soilType || 'loam', rootZoneDepthMm ?? 300,
      fieldCapacityMm ?? 150, wiltingPointMm ?? 45, moistureTargetPercent ?? 65,
      upperMoisturePercent ?? 75, pumpFlowLpm ?? 2,
      irrigationEfficiencyPercent ?? 75, dryingRateFactor ?? 1,
      operatingMode || 'simulation',
    ]
  );
  return result.insertId;
}

async function updateZone(id, {
  name,
  locationNote,
  gridX,
  gridY,
  moistureThreshold,
  areaM2,
  soilType,
  rootZoneDepthMm,
  fieldCapacityMm,
  wiltingPointMm,
  moistureTargetPercent,
  upperMoisturePercent,
  pumpFlowLpm,
  irrigationEfficiencyPercent,
  dryingRateFactor,
  operatingMode,
}) {
  await db.query(
    `UPDATE garden_zones SET name = ?, location_note = ?, grid_x = ?, grid_y = ?,
      moisture_threshold = ?, area_m2 = ?, soil_type = ?, root_zone_depth_mm = ?,
      field_capacity_mm = ?, wilting_point_mm = ?, moisture_target_percent = ?,
      upper_moisture_percent = ?, pump_flow_lpm = ?, irrigation_efficiency_percent = ?,
      drying_rate_factor = ?, operating_mode = ?
     WHERE id = ?`,
    [
      name, locationNote || null, gridX, gridY, moistureThreshold, areaM2,
      soilType, rootZoneDepthMm, fieldCapacityMm, wiltingPointMm,
      moistureTargetPercent, upperMoisturePercent, pumpFlowLpm,
      irrigationEfficiencyPercent, dryingRateFactor, operatingMode, id,
    ]
  );
}

async function deleteZone(id) {
  await db.query('DELETE FROM garden_zones WHERE id = ?', [id]);
}

module.exports = { getAllZones, getZoneById, createZone, updateZone, deleteZone };
