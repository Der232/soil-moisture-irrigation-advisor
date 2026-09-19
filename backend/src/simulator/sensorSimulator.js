/**
 * Simulated sensor pipeline.
 *
 * Stands in for real soil moisture sensors (see HARDWARE.md for the
 * physical build: an LM393-based resistive/capacitive probe on an ESP32)
 * until hardware is wired up. This simulates the actual measurement chain a
 * real sensor goes through, not just an abstract percentage:
 *
 *   raw ADC drift (physics) -> sensor noise -> calibration mapping to % ->
 *   POST to backend -> backend's advisor decides watered: true/false ->
 *   simulator applies the physical EFFECT of that decision (moisture rises
 *   only if the advisor actually said to water this zone).
 *
 * This last point matters: earlier versions of this simulator had the
 * simulated soil "water itself" whenever it crossed a hardcoded 30%
 * threshold, regardless of what the advisor (with its real, configurable
 * per-zone threshold and cooldown) actually decided. That meant the
 * simulated physical world and the decision-making logic could disagree —
 * e.g. a zone configured with a 50% threshold would get an advisor
 * "watered: true" at 45%, but the simulator wouldn't apply any physical
 * watering effect until its own unrelated 30% cutoff. Driving the moisture
 * bump off the actual API response closes that gap, and is also exactly
 * what real firmware will do (see HARDWARE.md's firmware reference).
 *
 * Drying isn't uniform: each zone has its own drying-rate multiplier (e.g.
 * a sunnier plot dries faster than a shaded one), and drying speeds up
 * during simulated "daytime" hours to mimic real evaporation patterns.
 *
 * Once real sensors exist, this file can be swapped for firmware that
 * performs the same measurement -> POST flow — the backend API contract
 * (POST /api/readings -> { moisturePercent }) does not need to change.
 */
require('dotenv').config();
const axios = require('axios');
const { ADC_BITS, ADC_MAX, rawToPercent, rawToVoltage } = require('./sensorCalibration');

const API_URL = process.env.SIMULATOR_API_URL || 'http://localhost:5001/api/readings';
const ZONE_COUNT = parseInt(process.env.SIMULATOR_ZONE_COUNT || '4', 10);
const INTERVAL_MS = parseInt(process.env.SIMULATOR_INTERVAL_MS || '5000', 10);

// Each simulated "day" compresses into this many minutes, purely for demo purposes,
// so day/night drying variation is visible without waiting for a real 24h cycle.
const SIMULATED_DAY_MINUTES = parseInt(process.env.SIMULATOR_DAY_MINUTES || '10', 10);

// Per-zone calibration: real sensor units vary slightly from one another
// even with identical soil, due to manufacturing tolerance and wiring.
// Each simulated zone gets its own wetRaw/dryRaw pair within a realistic
// band around the module's nominal spec, rather than sharing one constant.
const zoneCalibration = {};
const zoneRawValue = {}; // current simulated raw ADC reading per zone
const zoneDryingRate = {}; // each zone dries at a slightly different baseline rate

for (let i = 1; i <= ZONE_COUNT; i++) {
  const wetRaw = 1100 + Math.round(Math.random() * 200); // ~1100-1300
  const dryRaw = 2850 + Math.round(Math.random() * 300); // ~2850-3150
  zoneCalibration[i] = { wetRaw, dryRaw };
  // Start each zone reasonably moist: near the wet end of its own calibration range.
  zoneRawValue[i] = wetRaw + (dryRaw - wetRaw) * (0.15 + Math.random() * 0.15);
  zoneDryingRate[i] = 0.7 + Math.random() * 0.8; // 0.7x - 1.5x baseline drying speed
}

// Returns a 0.5-1.5 multiplier simulating stronger evaporation at "midday"
// and slower drying at simulated "night", based on wall-clock time compressed
// into SIMULATED_DAY_MINUTES-long cycles.
function timeOfDayFactor() {
  const cycleMs = SIMULATED_DAY_MINUTES * 60 * 1000;
  const phase = (Date.now() % cycleMs) / cycleMs; // 0..1 across the simulated day
  const sunAngle = Math.sin(phase * Math.PI * 2 - Math.PI / 2); // -1 (night) to 1 (midday)
  return 1 + sunAngle * 0.5; // ranges 0.5x (night) to 1.5x (midday)
}

// Simulates one ADC read's worth of electrical/quantization noise. Real
// ADC readings from these sensor modules are not perfectly stable even on
// bone-dry or fully-saturated soil -- expect several counts of jitter.
function adcNoise() {
  return (Math.random() - 0.5) * 24; // roughly +/-12 raw counts
}

/**
 * Advances one zone's simulated raw sensor value by one physical drying
 * step. This function only models drying -- it has no knowledge of
 * thresholds or watering decisions, mirroring how a real sensor only ever
 * reports what it measures and never decides anything itself.
 */
function driftZone(zoneId) {
  const { wetRaw, dryRaw } = zoneCalibration[zoneId];
  const range = dryRaw - wetRaw;
  const baseDriftFraction = 0.01 + Math.random() * 0.02; // 1-3% of the full range per tick, baseline
  const drift = range * baseDriftFraction * zoneDryingRate[zoneId] * timeOfDayFactor();

  zoneRawValue[zoneId] = Math.min(dryRaw, zoneRawValue[zoneId] + drift);
}

/**
 * Simulates the physical effect of a pump/relay having actually run for
 * this zone: moisture rises toward (but not perfectly to) full saturation,
 * since a single watering pulse doesn't instantly saturate the whole root
 * zone -- there's absorption/settling, which is why the raw value moves
 * most but not all of the way back toward wetRaw.
 */
function applyWateringEffect(zoneId) {
  const { wetRaw, dryRaw } = zoneCalibration[zoneId];
  const current = zoneRawValue[zoneId];
  const recoveryFraction = 0.6 + Math.random() * 0.25; // recovers 60-85% of the way to wetRaw
  zoneRawValue[zoneId] = current - (current - wetRaw) * recoveryFraction;
  zoneRawValue[zoneId] = Math.max(wetRaw, Math.min(dryRaw, zoneRawValue[zoneId]));
}

async function tick() {
  for (const zoneIdStr of Object.keys(zoneRawValue)) {
    const zoneId = Number(zoneIdStr);

    driftZone(zoneId);
    const measuredRaw = Math.max(0, Math.min(ADC_MAX, zoneRawValue[zoneId] + adcNoise()));
    const moisturePercent = Number(rawToPercent(measuredRaw, zoneCalibration[zoneId]).toFixed(2));

    try {
      const res = await axios.post(API_URL, {
        zoneId,
        moisturePercent,
        rawAdc: Math.round(measuredRaw),
        adcBits: ADC_BITS,
        sensorVoltageV: Number(rawToVoltage(measuredRaw, zoneCalibration[zoneId]).toFixed(3)),
        dataSource: 'simulated',
        temperatureC: 25,
        relativeHumidityPercent: 50,
        windFactor: 1,
        solarFactor: 1,
        sensorStatus: 'ok',
      });
      const advisorResult = res.data && res.data.advisorResult;

      console.log(
        `Zone ${zoneId}: raw=${Math.round(measuredRaw)} -> ${moisturePercent}%` +
          (advisorResult && advisorResult.watered ? ' -> WATERING TRIGGERED' : '')
      );

      // Only apply the physical "moisture went up" effect if the backend's
      // advisor actually decided to water this zone (respecting its real
      // per-zone threshold and cooldown) -- not a hardcoded local guess.
      if (advisorResult && advisorResult.watered) {
        applyWateringEffect(zoneId);
      }
    } catch (err) {
      console.error(`Failed to post reading for zone ${zoneId}:`, err.message);
    }
  }
}

console.log(
  `Starting sensor simulator: ${ZONE_COUNT} zones, every ${INTERVAL_MS}ms, simulated day = ${SIMULATED_DAY_MINUTES}min, ADC_MAX=${ADC_MAX}`
);
setInterval(tick, INTERVAL_MS);
tick();
