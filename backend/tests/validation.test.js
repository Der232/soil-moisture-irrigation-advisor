const express = require('express');
const request = require('supertest');
const {
  handleValidation,
  readingRules,
  zoneRules,
  manualWaterRules,
  reservoirRules,
  calibrationRules,
} = require('../src/middleware/validation');

function buildApp(rules) {
  const app = express();
  app.use(express.json());
  app.post('/test', rules, handleValidation, (req, res) => res.json({ ok: true }));
  return app;
}

describe('readingRules', () => {
  const app = buildApp(readingRules);

  it('rejects an out-of-range moisture value', async () => {
    const res = await request(app).post('/test').send({ zoneId: 1, moisturePercent: 150 });
    expect(res.status).toBe(400);
    expect(res.body.details[0].msg).toMatch(/between 0 and 100/);
  });

  it('rejects a missing zoneId', async () => {
    const res = await request(app).post('/test').send({ moisturePercent: 45 });
    expect(res.status).toBe(400);
  });

  it('accepts a valid reading', async () => {
    const res = await request(app).post('/test').send({ zoneId: 1, moisturePercent: 45.5 });
    expect(res.status).toBe(200);
  });

  it('rejects a raw ADC value outside the selected resolution', async () => {
    const res = await request(app).post('/test').send({
      zoneId: 1,
      moisturePercent: 45,
      adcBits: 10,
      rawAdc: 2048,
    });
    expect(res.status).toBe(400);
    expect(res.body.details.map((detail) => detail.msg).join(' ')).toMatch(/ADC range/);
  });
});

describe('zoneRules', () => {
  const app = buildApp(zoneRules);

  it('rejects an empty zone name', async () => {
    const res = await request(app).post('/test').send({ name: '' });
    expect(res.status).toBe(400);
  });

  it('rejects an out-of-range moistureThreshold', async () => {
    const res = await request(app).post('/test').send({ name: 'Zone A', moistureThreshold: 200 });
    expect(res.status).toBe(400);
  });

  it('accepts a valid zone payload', async () => {
    const res = await request(app)
      .post('/test')
      .send({ name: 'Zone A', gridX: 1, gridY: 2, moistureThreshold: 40 });
    expect(res.status).toBe(200);
  });

  it('rejects a wilting point above field capacity', async () => {
    const res = await request(app).post('/test').send({
      name: 'Zone A',
      fieldCapacityMm: 100,
      wiltingPointMm: 120,
    });
    expect(res.status).toBe(400);
  });
});

describe('manualWaterRules', () => {
  const app = buildApp(manualWaterRules);

  it('rejects a non-integer zoneId', async () => {
    const res = await request(app).post('/test').send({ zoneId: 'abc' });
    expect(res.status).toBe(400);
  });

  it('accepts a valid zoneId', async () => {
    const res = await request(app).post('/test').send({ zoneId: 3 });
    expect(res.status).toBe(200);
  });

  it('rejects a duration above the actuator safety limit', async () => {
    const res = await request(app).post('/test').send({ zoneId: 3, durationSeconds: 301 });
    expect(res.status).toBe(400);
  });
});

describe('reservoirRules', () => {
  const app = buildApp(reservoirRules);

  it('rejects a level above reservoir capacity', async () => {
    const res = await request(app).post('/test').send({
      capacityL: 10,
      currentLevelL: 11,
      dailyBudgetL: 5,
    });
    expect(res.status).toBe(400);
  });
});

describe('calibrationRules', () => {
  const app = buildApp(calibrationRules);

  it('rejects identical calibration endpoints', async () => {
    const res = await request(app).post('/test').send({
      adcBits: 12,
      referenceVoltageV: 3.3,
      wetRaw: 2000,
      dryRaw: 2000,
    });
    expect(res.status).toBe(400);
  });
});
