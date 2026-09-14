/**
 * Seeds the database with a few days of historical moisture readings and
 * irrigation events per zone, so the dashboard's history chart and log
 * aren't empty the first time it's opened — before the live simulator
 * has had time to build up real history.
 *
 * Run with: node src/seed.js
 * Safe to re-run: skips zones that already have readings.
 */
require('dotenv').config();
const db = require('./config/db');

const HOURS_OF_HISTORY = 48; // 2 simulated days
const READING_INTERVAL_HOURS = 1;

async function getZones() {
  const [rows] = await db.query('SELECT id FROM garden_zones ORDER BY id ASC');
  return rows;
}

async function zoneHasReadings(zoneId) {
  const [rows] = await db.query('SELECT id FROM sensor_readings WHERE zone_id = ? LIMIT 1', [zoneId]);
  return rows.length > 0;
}

function simulateHistoricalMoisture(hoursAgo, dryingRate) {
  // A gentle sine wave (day/night cycle) plus a slow drying trend, clamped 20-90%
  const cyclePosition = (hoursAgo % 24) / 24;
  const dayNightSwing = Math.sin(cyclePosition * Math.PI * 2) * 10;
  const baseline = 55 - hoursAgo * dryingRate * 0.15;
  const noise = (Math.random() - 0.5) * 6;
  return Math.max(20, Math.min(90, baseline + dayNightSwing + noise));
}

async function seedZoneHistory(zoneId) {
  const dryingRate = 0.7 + Math.random() * 0.8;
  const now = Date.now();

  for (let hoursAgo = HOURS_OF_HISTORY; hoursAgo >= 0; hoursAgo -= READING_INTERVAL_HOURS) {
    const moisture = Number(simulateHistoricalMoisture(hoursAgo, dryingRate).toFixed(2));
    const recordedAt = new Date(now - hoursAgo * 60 * 60 * 1000);
    const recordedAtSql = recordedAt.toISOString().slice(0, 19).replace('T', ' ');

    await db.query(
      'INSERT INTO sensor_readings (zone_id, moisture_percent, recorded_at) VALUES (?, ?, ?)',
      [zoneId, moisture, recordedAtSql]
    );

    // Occasionally log a matching irrigation event when moisture was low, for a realistic log
    if (moisture < 30) {
      await db.query(
        'INSERT INTO irrigation_events (zone_id, triggered_by, moisture_before, started_at) VALUES (?, ?, ?, ?)',
        [zoneId, 'auto', moisture, recordedAtSql]
      );
    }
  }
}

async function seed() {
  console.log('Seeding historical sensor data...');
  const zones = await getZones();

  if (zones.length === 0) {
    console.log('No garden zones found — run the schema migration first (it seeds starter zones).');
    process.exit(1);
  }

  for (const zone of zones) {
    if (await zoneHasReadings(zone.id)) {
      console.log(`Zone ${zone.id} already has readings, skipping.`);
      continue;
    }
    await seedZoneHistory(zone.id);
    console.log(`Seeded ${HOURS_OF_HISTORY / READING_INTERVAL_HOURS} readings for zone ${zone.id}.`);
  }

  console.log('Seed complete.');
  process.exit(0);
}

seed().catch((err) => {
  if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    console.error('Seeding failed: Cannot connect to MySQL.');
    console.error('Check your .env file — make sure DB_PASSWORD is set to your MySQL root password.');
    console.error('Current settings: DB_USER=' + (process.env.DB_USER || 'root') + ', DB_NAME=' + (process.env.DB_NAME || 'soil_irrigation'));
  } else {
    console.error('Seeding failed:', err);
  }
  process.exit(1);
});
