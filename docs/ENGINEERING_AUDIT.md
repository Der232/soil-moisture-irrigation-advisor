# Repository audit and improvement roadmap

Audit baseline: `main` at commit `88ca381` (September 2026).

## What already existed

| Area | Existing implementation | Purpose | Limitation found | Priority |
|---|---|---|---|---|
| Browser simulation | `frontend/src/simulation/irrigationEngine.js` | Demonstrates ADC drift, calibration, drying, thresholds, cooldown, and watering response without a backend | Moisture recovery is a raw-value shortcut; there is no explicit water storage, rainfall, ET, drainage, reservoir, or safety budget | 1 |
| Backend sensor path | `backend/src/simulator/sensorSimulator.js`, `backend/src/controllers/readingController.js` | Posts simulated readings through the same endpoint intended for hardware | Readings only persisted a percentage; raw ADC, voltage, environmental inputs, and data provenance were not retained | 1 |
| Calibration | `backend/src/simulator/sensorCalibration.js` | Maps wet/dry raw ADC references to a relative percentage | Calibration was not validated through an API and did not expose ADC voltage or reversed-orientation metadata | 1 |
| Advisor | `backend/src/utils/irrigationAdvisor.js` | Per-zone threshold and cooldown decision | A below-threshold decision did not account for pump volume, reservoir availability, hysteresis target, or blocked/failed outcomes | 1 |
| Zones | `backend/migrations/001_init_schema.sql`, `002_add_zone_moisture_threshold.sql` | Stores garden layout and a per-zone threshold | No area, soil storage parameters, pump configuration, operating mode, or drying parameters | 1 |
| API and persistence | `backend/src/routes`, `controllers`, and `models` | Separates HTTP handlers from MySQL queries | No calibration endpoint, engineering fields, reservoir state, or event volume/status fields | 1 |
| Frontend fallback | `frontend/src/data/dataSource.js`, `simStore.js` | Keeps demonstrations usable without MySQL | Live and simulation modes use different state shapes and cannot reproduce controlled environmental scenarios | 2 |
| Dashboard and 3D scene | `frontend/src/pages/Dashboard.jsx`, `frontend/src/three/GardenScene3D.jsx` | Displays zones, readings, charts, and illustrative hardware | The 3D sprinkler cue is inferred from moisture below threshold rather than a recorded irrigation state | 2 |
| Tests | `backend/tests/*.test.js` | Covers validation, controller behavior, threshold, and cooldown | No model tests for calibration, water balance, ET, volume, rainfall, reservoir limits, or multi-zone scenarios | 1 |
| Documentation | `README.md` | Explains setup, hardware, and the existing simulation | It correctly calls the simulation simulated, but did not define storage units, model equations, or measurable engineering metrics | 2 |

## What this implementation pass changes

This first engineering chunk adds:

- Explicit water-balance calculations in `backend/src/utils/engineeringModel.js`.
- Unit conventions and assumptions in `backend/migrations/003_engineering_model.sql`.
- Zone parameters for area, soil storage, root-zone depth, target, pump flow,
  efficiency, drying factor, and operating mode.
- Sensor reading metadata for raw ADC, ADC resolution, voltage, environment,
  provenance, and sensor status.
- Per-zone calibration persistence and `GET/PUT /api/calibrations/:zoneId`.
- A validated, orientation-aware raw-to-moisture conversion.
- Irrigation event fields for mode, status, reason, duration, and water-volume
  accounting.
- Unit tests for calibration, ADC voltage, ET proxy, water balance, irrigation
  volume, and storage conversion.

## Remaining roadmap

1. Connect advisor decisions to reservoir/pump safety and hysteresis.
2. Replace the browser raw drift shortcut with the same water-balance model.
3. Add deterministic scenario controls for rainfall, weather, sensor failure,
   pump failure, and simulation speed.
4. Add dashboard metrics for retained water, drainage, threshold time, cycles,
   and reservoir status.
5. Bind 3D animation to actual simulation event state rather than inference.
6. Add integration tests around the new API and migration-backed persistence.
7. Update the user guide and project-report sections with actual results.