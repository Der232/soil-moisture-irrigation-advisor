-- Engineering model extensions.
--
-- Units:
--   * root-zone water storage, rainfall, ET, and drainage are millimetres
--     of water over the zone area (1 mm over 1 m² = 1 litre).
--   * moisture_percent is a relative position between wilting_point_mm and
--     field_capacity_mm. It is not a laboratory volumetric water-content
--     measurement.
--
-- Apply after migrations/001_init_schema.sql and 002_add_zone_moisture_threshold.sql.

USE soil_irrigation;

ALTER TABLE garden_zones
  ADD COLUMN area_m2 DECIMAL(8,2) NOT NULL DEFAULT 10.00,
  ADD COLUMN soil_type VARCHAR(40) NOT NULL DEFAULT 'loam',
  ADD COLUMN root_zone_depth_mm DECIMAL(8,2) NOT NULL DEFAULT 300.00,
  ADD COLUMN field_capacity_mm DECIMAL(8,2) NOT NULL DEFAULT 150.00,
  ADD COLUMN wilting_point_mm DECIMAL(8,2) NOT NULL DEFAULT 45.00,
  ADD COLUMN moisture_target_percent DECIMAL(5,2) NOT NULL DEFAULT 65.00,
  ADD COLUMN upper_moisture_percent DECIMAL(5,2) NOT NULL DEFAULT 75.00,
  ADD COLUMN pump_flow_lpm DECIMAL(8,3) NOT NULL DEFAULT 2.000,
  ADD COLUMN irrigation_efficiency_percent DECIMAL(5,2) NOT NULL DEFAULT 75.00,
  ADD COLUMN drying_rate_factor DECIMAL(6,3) NOT NULL DEFAULT 1.000,
  ADD COLUMN operating_mode ENUM('manual', 'automatic', 'simulation') NOT NULL DEFAULT 'simulation';

ALTER TABLE sensor_readings
  ADD COLUMN raw_adc INT NULL,
  ADD COLUMN adc_bits TINYINT UNSIGNED NOT NULL DEFAULT 12,
  ADD COLUMN sensor_voltage_v DECIMAL(5,3) NULL,
  ADD COLUMN data_source ENUM('simulated', 'hardware', 'manual') NOT NULL DEFAULT 'simulated',
  ADD COLUMN temperature_c DECIMAL(5,2) NULL,
  ADD COLUMN relative_humidity_percent DECIMAL(5,2) NULL,
  ADD COLUMN rainfall_mm DECIMAL(7,2) NOT NULL DEFAULT 0.00,
  ADD COLUMN wind_factor DECIMAL(5,3) NOT NULL DEFAULT 1.000,
  ADD COLUMN solar_factor DECIMAL(5,3) NOT NULL DEFAULT 1.000,
  ADD COLUMN sensor_status ENUM('ok', 'noisy', 'disconnected', 'out_of_range') NOT NULL DEFAULT 'ok';

ALTER TABLE irrigation_events
  ADD COLUMN mode ENUM('manual', 'automatic', 'simulation') NOT NULL DEFAULT 'automatic',
  ADD COLUMN status ENUM('requested', 'approved', 'completed', 'blocked', 'failed') NOT NULL DEFAULT 'completed',
  ADD COLUMN reason VARCHAR(255) NULL,
  ADD COLUMN duration_seconds INT UNSIGNED NULL,
  ADD COLUMN requested_volume_l DECIMAL(10,3) NULL,
  ADD COLUMN delivered_volume_l DECIMAL(10,3) NULL,
  ADD COLUMN retained_volume_l DECIMAL(10,3) NULL,
  ADD COLUMN drainage_volume_l DECIMAL(10,3) NULL,
  ADD COLUMN completed_at TIMESTAMP NULL;

CREATE TABLE IF NOT EXISTS sensor_calibrations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zone_id INT NOT NULL UNIQUE,
  adc_bits TINYINT UNSIGNED NOT NULL DEFAULT 12,
  reference_voltage_v DECIMAL(5,3) NOT NULL DEFAULT 3.300,
  wet_raw INT NOT NULL,
  dry_raw INT NOT NULL,
  calibration_note VARCHAR(255) NULL,
  calibrated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (zone_id) REFERENCES garden_zones(id) ON DELETE CASCADE,
  CONSTRAINT calibration_adc_range CHECK (wet_raw >= 0 AND dry_raw >= 0)
);

CREATE TABLE IF NOT EXISTS reservoir_state (
  id TINYINT UNSIGNED PRIMARY KEY,
  capacity_l DECIMAL(10,3) NOT NULL,
  current_level_l DECIMAL(10,3) NOT NULL,
  daily_budget_l DECIMAL(10,3) NOT NULL,
  daily_used_l DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  budget_date DATE NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

INSERT IGNORE INTO reservoir_state
  (id, capacity_l, current_level_l, daily_budget_l, daily_used_l, budget_date)
VALUES
  (1, 500.000, 500.000, 100.000, 0.000, CURRENT_DATE);

CREATE INDEX idx_sensor_readings_zone_recorded
  ON sensor_readings (zone_id, recorded_at);

CREATE INDEX idx_irrigation_events_zone_started
  ON irrigation_events (zone_id, started_at);