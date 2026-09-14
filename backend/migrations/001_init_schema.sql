-- Low-cost Soil Moisture & Irrigation Advisor - Initial Schema
-- Creates the database and all tables needed by the backend.

CREATE DATABASE IF NOT EXISTS soil_irrigation
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE soil_irrigation;

CREATE TABLE IF NOT EXISTS garden_zones (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  location_note VARCHAR(200),
  grid_x INT NOT NULL DEFAULT 0,
  grid_y INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS sensor_readings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zone_id INT NOT NULL,
  moisture_percent DECIMAL(5,2) NOT NULL,
  recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (zone_id) REFERENCES garden_zones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS irrigation_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  zone_id INT NOT NULL,
  triggered_by ENUM('auto', 'manual') NOT NULL DEFAULT 'auto',
  moisture_before DECIMAL(5,2),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (zone_id) REFERENCES garden_zones(id) ON DELETE CASCADE
);

-- Seed a few starter zones so the dashboard has something to show immediately
INSERT INTO garden_zones (name, location_note, grid_x, grid_y) VALUES
  ('Zone A - Front Garden', 'Near main entrance', 0, 0),
  ('Zone B - Courtyard', 'Central courtyard beds', 1, 0),
  ('Zone C - Greenhouse Strip', 'Beside greenhouse', 0, 1),
  ('Zone D - Herb Garden', 'Behind cafeteria', 1, 1);
