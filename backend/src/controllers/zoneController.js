const { getAllZones, getZoneById, createZone, updateZone, deleteZone } = require('../models/zoneModel');

async function listZones(req, res) {
  try {
    const zones = await getAllZones();
    res.json(zones);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch zones', details: err.message });
  }
}

/**
 * Returns a single zone's config. Intended for both the frontend and, once
 * deployed, sensor firmware — a device can fetch its own zone's
 * moisture_threshold on boot (before it has posted any reading yet) so it
 * knows the threshold to compare against without hardcoding it in firmware.
 */
async function getZone(req, res) {
  try {
    const zone = await getZoneById(req.params.id);
    if (!zone) return res.status(404).json({ error: 'Zone not found' });
    res.json(zone);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch zone', details: err.message });
  }
}

async function addZone(req, res) {
  try {
    const {
      name, locationNote, gridX, gridY, moistureThreshold, areaM2, soilType,
      rootZoneDepthMm, fieldCapacityMm, wiltingPointMm, moistureTargetPercent,
      upperMoisturePercent, pumpFlowLpm, irrigationEfficiencyPercent,
      dryingRateFactor, operatingMode,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const id = await createZone({
      name, locationNote, gridX, gridY, moistureThreshold, areaM2, soilType,
      rootZoneDepthMm, fieldCapacityMm, wiltingPointMm, moistureTargetPercent,
      upperMoisturePercent, pumpFlowLpm, irrigationEfficiencyPercent,
      dryingRateFactor, operatingMode,
    });
    res.status(201).json({ id, name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create zone', details: err.message });
  }
}

async function editZone(req, res) {
  try {
    const existing = await getZoneById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Zone not found' });

    const {
      name, locationNote, gridX, gridY, moistureThreshold, areaM2, soilType,
      rootZoneDepthMm, fieldCapacityMm, wiltingPointMm, moistureTargetPercent,
      upperMoisturePercent, pumpFlowLpm, irrigationEfficiencyPercent,
      dryingRateFactor, operatingMode,
    } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    await updateZone(req.params.id, {
      name,
      locationNote,
      gridX: gridX ?? existing.grid_x,
      gridY: gridY ?? existing.grid_y,
      moistureThreshold: moistureThreshold ?? existing.moisture_threshold,
      areaM2: areaM2 ?? existing.area_m2,
      soilType: soilType ?? existing.soil_type,
      rootZoneDepthMm: rootZoneDepthMm ?? existing.root_zone_depth_mm,
      fieldCapacityMm: fieldCapacityMm ?? existing.field_capacity_mm,
      wiltingPointMm: wiltingPointMm ?? existing.wilting_point_mm,
      moistureTargetPercent: moistureTargetPercent ?? existing.moisture_target_percent,
      upperMoisturePercent: upperMoisturePercent ?? existing.upper_moisture_percent,
      pumpFlowLpm: pumpFlowLpm ?? existing.pump_flow_lpm,
      irrigationEfficiencyPercent: irrigationEfficiencyPercent ?? existing.irrigation_efficiency_percent,
      dryingRateFactor: dryingRateFactor ?? existing.drying_rate_factor,
      operatingMode: operatingMode ?? existing.operating_mode,
    });
    res.json({ id: Number(req.params.id), name });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update zone', details: err.message });
  }
}

async function removeZone(req, res) {
  try {
    const existing = await getZoneById(req.params.id);
    if (!existing) return res.status(404).json({ error: 'Zone not found' });

    await deleteZone(req.params.id);
    res.json({ message: 'Zone deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete zone', details: err.message });
  }
}

module.exports = { listZones, getZone, addZone, editZone, removeZone };
