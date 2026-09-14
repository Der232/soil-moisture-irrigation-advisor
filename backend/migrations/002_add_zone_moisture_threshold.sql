-- Adds a configurable watering threshold per garden zone, instead of a single
-- global MOISTURE_THRESHOLD env var. Existing zones default to 30%, matching
-- the previous global default, so behavior is unchanged until a zone's
-- threshold is explicitly customized.

USE soil_irrigation;

ALTER TABLE garden_zones
  ADD COLUMN moisture_threshold DECIMAL(5,2) NOT NULL DEFAULT 30.00;
