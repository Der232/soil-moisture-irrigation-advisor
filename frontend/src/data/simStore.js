/**
 * In-browser simulation store that produces API-shaped data.
 *
 * Tries the real backend first; if it's unreachable, silently falls back
 * to the browser-based irrigation engine so the dashboard, log, and zone
 * management all work without a server or database.
 */
import { createDefaultZones, createZone, tickSimulation, manualWater } from '../simulation/irrigationEngine';

const TICK_MS = 2000;
const COOLDOWN_MINUTES = 10;
const SIMULATED_DAY_MINUTES = 10;

let zones = createDefaultZones();
let listeners = new Set();
let intervalId = null;

function notify() {
  listeners.forEach((fn) => fn());
}

function startTicking() {
  if (intervalId) return;
  intervalId = setInterval(() => {
    tickSimulation(zones, {
      cooldownMinutes: COOLDOWN_MINUTES,
      simulatedDayMinutes: SIMULATED_DAY_MINUTES,
    });
    notify();
  }, TICK_MS);
}

function stopTicking() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

startTicking();

function toApiZone(z) {
  return {
    id: z.id,
    name: z.name,
    location_note: z.locationNote,
    grid_x: z.gridX,
    grid_y: z.gridY,
    moisture_threshold: z.moistureThreshold,
    created_at: new Date().toISOString(),
  };
}

function toApiReading(z) {
  return {
    zone_id: z.id,
    moisture_percent: z.currentMoisture,
    recorded_at: new Date().toISOString(),
  };
}

function toApiHistory(z) {
  return z.history.slice().reverse().map((h) => ({
    moisture_percent: h.moisture,
    recorded_at: new Date(h.timestamp).toISOString(),
  }));
}

function toApiEvent(e) {
  return {
    id: e.id,
    zone_id: e.zoneId,
    zone_name: e.zoneName,
    triggered_by: e.triggeredBy,
    moisture_before: e.moistureBefore,
    started_at: new Date(e.timestamp).toISOString(),
  };
}

export const simStore = {
  subscribe(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  },

  getZones() {
    return zones.map(toApiZone);
  },

  getLatestReadings() {
    return zones.map(toApiReading);
  },

  getHistory(zoneId) {
    const z = zones.find((z) => z.id === zoneId);
    return z ? toApiHistory(z) : [];
  },

  getEvents() {
    return zones
      .flatMap((z) => z.events)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 20)
      .map(toApiEvent);
  },

  addZone({ name, locationNote, gridX, gridY, moistureThreshold }) {
    const newId = Math.max(0, ...zones.map((z) => z.id)) + 1;
    const z = createZone({
      id: newId,
      name,
      locationNote,
      gridX,
      gridY,
      threshold: moistureThreshold,
    });
    z.rawValue = z.calibration.dryRaw * 0.7;
    z.currentMoisture = 15;
    zones.push(z);
    notify();
    return toApiZone(z);
  },

  deleteZone(zoneId) {
    zones = zones.filter((z) => z.id !== zoneId);
    notify();
  },

  manualWater(zoneId) {
    const z = zones.find((z) => z.id === zoneId);
    if (!z) return;
    manualWater(z);
    notify();
  },
};
