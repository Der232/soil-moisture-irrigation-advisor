/**
 * Sensor calibration constants and the raw-ADC-to-percentage mapping.
 *
 * Real resistive/capacitive soil moisture sensors (see HARDWARE.md) output
 * a raw analog value, not a moisture percentage directly. Per the sensor
 * behavior documented in HARDWARE.md: raw value INCREASES as soil dries
 * (dry soil = higher resistance = higher voltage at the ADC pin for these
 * modules), which is why a raw value ABOVE a "dry" threshold means "too dry"
 * in the reference Arduino sketch this project is modeled on.
 *
 * Every physical sensor unit reads slightly differently even for the same
 * soil moisture level (manufacturing variance, wiring, probe corrosion over
 * time), which is why calibration is per-device, not a fixed constant —
 * see HARDWARE.md's calibration procedure. This module's DEFAULT_CALIBRATION
 * stands in for values you'd get by actually calibrating a real sensor
 * (submerge in water for the wet point, let dry completely in air for the
 * dry point).
 *
 * ADC_MAX defaults to 4095 (ESP32's 12-bit ADC, the recommended
 * microcontroller since it has built-in WiFi). If using an Arduino Uno's
 * 10-bit ADC via a serial bridge instead (see HARDWARE.md's budget path),
 * ADC_MAX should be 1023 and calibration values re-taken at that
 * resolution — the two are not interchangeable.
 */

const {
  validateCalibration,
  rawToMoisturePercent,
  rawToVoltage,
} = require('../utils/engineeringModel');

const ADC_BITS = 12;
const ADC_MAX = (2 ** ADC_BITS) - 1;

// Per-zone calibration, simulating that each physical sensor unit calibrates
// slightly differently. In a real deployment these would come from each
// device's own calibration procedure, not a shared constant.
const DEFAULT_CALIBRATION = {
  wetRaw: 1200, // raw ADC reading when the probe is fully submerged in water
  dryRaw: 3000, // raw ADC reading when the probe is completely dry (in air)
  adcBits: ADC_BITS,
  referenceVoltageV: 3.3,
};

/**
 * Converts a raw ADC reading into a 0-100 moisture percentage, using this
 * zone's calibration. Clamped to [0, 100] since real sensors can read
 * slightly beyond their calibrated extremes due to noise or drift.
 *
 * Note the inversion: rawValue near dryRaw -> 0% (dry), rawValue near
 * wetRaw -> 100% (wet) — matching the sensor behavior described above.
 */
function rawToPercent(rawValue, calibration = DEFAULT_CALIBRATION) {
  return rawToMoisturePercent(rawValue, {
    ...DEFAULT_CALIBRATION,
    ...calibration,
  });
}

function rawToVoltageValue(rawValue, calibration = DEFAULT_CALIBRATION) {
  return rawToVoltage(
    rawValue,
    calibration.adcBits || ADC_BITS,
    calibration.referenceVoltageV || 3.3
  );
}

module.exports = {
  ADC_BITS,
  ADC_MAX,
  DEFAULT_CALIBRATION,
  rawToPercent,
  rawToVoltage: rawToVoltageValue,
  validateCalibration,
};
