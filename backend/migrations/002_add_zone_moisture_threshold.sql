-- Adds a configurable watering threshold per garden zone, instead of a single
-- global MOISTURE_THRESHOLD env var. Existing zones default to 30%, matching
-- the previous global default, so behavior is unchanged until a zone's
-- threshold is explicitly customized.
--
-- Safe to re-run: checks whether the column already exists before adding it.

USE soil_irrigation;

DROP PROCEDURE IF EXISTS add_moisture_threshold_if_missing;

DELIMITER //
CREATE PROCEDURE add_moisture_threshold_if_missing()
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = 'soil_irrigation'
      AND TABLE_NAME = 'garden_zones'
      AND COLUMN_NAME = 'moisture_threshold'
  ) THEN
    ALTER TABLE garden_zones
      ADD COLUMN moisture_threshold DECIMAL(5,2) NOT NULL DEFAULT 30.00;
  END IF;
END //
DELIMITER ;

CALL add_moisture_threshold_if_missing();
DROP PROCEDURE IF EXISTS add_moisture_threshold_if_missing;
