# Repository audit and improvement roadmap

Audit baseline: `main` at commit `219612e` (September 2026), after the
reservoir-safety, browser-model, and sensor-safety implementation passes.

## What already existed

| Area | Existing implementation | Purpose | Limitation found | Priority |
|---|---|---|---|---|
| Browser simulation | `frontend/src/simulation/irrigationEngine.js` | Runs an offline sensor-to-decision demonstration with per-zone calibration and a shared reservoir | It is still a simplified model and has not been validated against field measurements | 2 |
| Backend sensor path | `backend/src/simulator/sensorSimulator.js`, `backend/src/controllers/readingController.js` | Posts simulated readings through the same endpoint intended for hardware | Readings only persisted a percentage; raw ADC, voltage, environmental inputs, and data provenance were not retained | 1 |
| Calibration | `backend/src/simulator/sensorCalibration.js` | Maps wet/dry raw ADC references to a relative percentage | Calibration was not validated through an API and did not expose ADC voltage or reversed-orientation metadata | 1 |
| Advisor | `backend/src/utils/irrigationAdvisor.js` | Per-zone threshold, target, cooldown, pump-volume, and reservoir-gated decision | Physical pump feedback and persistent actuator state are not connected | 2 |
| Zones | `backend/migrations/001_init_schema.sql`, `002_add_zone_moisture_threshold.sql` | Stores garden layout and a per-zone threshold | No area, soil storage parameters, pump configuration, operating mode, or drying parameters | 1 |
| API and persistence | `backend/src/routes`, `controllers`, and `models` | Separates HTTP handlers from MySQL queries | No calibration endpoint, engineering fields, reservoir state, or event volume/status fields | 1 |
| Frontend fallback | `frontend/src/data/dataSource.js`, `simStore.js` | Keeps demonstrations usable without MySQL | Live and simulation modes use different state shapes and cannot reproduce controlled environmental scenarios | 2 |
| Dashboard and 3D scene | `frontend/src/pages/Dashboard.jsx`, `frontend/src/three/GardenScene3D.jsx` | Displays zones, readings, charts, and hardware relationships | Live API responses do not yet expose a time-windowed active-pump state, so the 3D animation stays off unless the response explicitly reports one | 2 |
| Tests | `backend/tests/*.test.js` | Covers validation, controller behavior, threshold, and cooldown | No model tests for calibration, water balance, ET, volume, rainfall, reservoir limits, or multi-zone scenarios | 1 |
| Documentation | `README.md` | Explains setup, hardware, and the existing simulation | It correctly calls the simulation simulated, but did not define storage units, model equations, or measurable engineering metrics | 2 |

## What the implementation passes change

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
- Browser simulation parity with the storage balance, rainfall, ET proxy,
  drainage, deterministic noise, reservoir budget, pump failure, and sensor
  failure controls.
- Automatic watering inhibition for `disconnected`, `noisy`, and
  `out_of_range` sensor statuses.
- Persisted raw ADC, voltage, data-source, environment, and sensor-status
  fields in latest/history reading responses.
- Validation for ADC range, calibration endpoints, soil storage bounds,
  reservoir level, actuator duration, and target/upper-threshold ordering.
- Regression tests for calibration, ADC voltage, ET proxy, water balance,
  irrigation volume, storage conversion, sensor inhibition, and validation.

## Remaining roadmap

1. Add persisted dashboard metrics for retained water, drainage, threshold
   time, cycles, and reservoir status in the live API view.
2. Add integration tests around API validation and migration-backed
   persistence using a disposable MySQL test database.
3. Replace the Node simulator's raw-drift shortcut with the same water-balance
   engine used by the browser demo, or explicitly keep it as a separate
   sensor-only fixture.
4. Add a time-windowed pump-active field to live reading/status responses so
   the 3D scene can animate completed actuator events without inference.
5. Calibrate the simplified ET and storage defaults against measured local
   observations before making any physical water-saving claim.