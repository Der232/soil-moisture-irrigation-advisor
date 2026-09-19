jest.mock('../src/models/zoneModel');
jest.mock('../src/models/irrigationModel');
jest.mock('../src/models/reservoirModel');

const { getZoneById } = require('../src/models/zoneModel');
const { logIrrigationEvent, getMostRecentEventForZone } = require('../src/models/irrigationModel');
const { reserveWater } = require('../src/models/reservoirModel');
const { evaluateZone } = require('../src/utils/irrigationAdvisor');

beforeEach(() => {
  jest.clearAllMocks();
  // Default: no prior irrigation event exists for the zone, so cooldown
  // never blocks a test unless a test explicitly sets up a recent one.
  getMostRecentEventForZone.mockResolvedValue(null);
  logIrrigationEvent.mockResolvedValue(123);
  reserveWater.mockResolvedValue({
    approved: true,
    requestedVolumeL: 1,
    remainingVolumeL: 499,
    remainingBudgetL: 99,
  });
});

describe('evaluateZone', () => {
  it('does not water a zone above its threshold', async () => {
    getZoneById.mockResolvedValue({ id: 1, moisture_threshold: 30 });

    const result = await evaluateZone({ zoneId: 1, moisturePercent: 35 });

    expect(result).toEqual({ watered: false, threshold: 30 });
    expect(logIrrigationEvent).not.toHaveBeenCalled();
  });

  it('waters a zone below its threshold and logs the event', async () => {
    getZoneById.mockResolvedValue({ id: 1, moisture_threshold: 30 });

    const result = await evaluateZone({ zoneId: 1, moisturePercent: 25 });

    expect(result.watered).toBe(true);
    expect(result.threshold).toBe(30);
    expect(logIrrigationEvent).toHaveBeenCalledWith(expect.objectContaining({
      zoneId: 1,
      triggeredBy: 'auto',
      moistureBefore: 25,
      status: 'completed',
    }));
  });

  it('respects a higher per-zone threshold, watering earlier than the 30% default', async () => {
    getZoneById.mockResolvedValue({ id: 2, moisture_threshold: 50 });

    const result = await evaluateZone({ zoneId: 2, moisturePercent: 45 });

    // 45% is above the old global default of 30%, but below this zone's
    // custom 50% threshold, so it should still trigger watering.
    expect(result.watered).toBe(true);
    expect(result.threshold).toBe(50);
  });

  it('respects a lower per-zone threshold, not watering until moisture drops further', async () => {
    getZoneById.mockResolvedValue({ id: 3, moisture_threshold: 15 });

    const result = await evaluateZone({ zoneId: 3, moisturePercent: 20 });

    // 20% would trigger watering under the default 30% threshold, but this
    // zone's custom 15% threshold means it shouldn't water yet.
    expect(result).toEqual({ watered: false, threshold: 15 });
  });

  it('falls back to the default threshold if the zone cannot be found', async () => {
    getZoneById.mockResolvedValue(null);

    const result = await evaluateZone({ zoneId: 999, moisturePercent: 25 });

    expect(result.threshold).toBe(30);
    expect(result.watered).toBe(false);
    expect(result.blocked).toBe(true);
    expect(result.reason).toBe('Zone not found');
  });

  describe('cooldown behavior (prevents re-triggering a physical pump every reading)', () => {
    it('does not re-water or log a new event if still within the cooldown window', async () => {
      getZoneById.mockResolvedValue({ id: 1, moisture_threshold: 30 });
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
      getMostRecentEventForZone.mockResolvedValue({
        id: 1,
        zone_id: 1,
        triggered_by: 'auto',
        started_at: twoMinutesAgo,
      });

      const result = await evaluateZone({ zoneId: 1, moisturePercent: 20 });

      expect(result).toEqual({ watered: false, threshold: 30, withinCooldown: true });
      expect(logIrrigationEvent).not.toHaveBeenCalled();
    });

    it('waters again once the cooldown window has passed', async () => {
      getZoneById.mockResolvedValue({ id: 1, moisture_threshold: 30 });
      const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000).toISOString();
      getMostRecentEventForZone.mockResolvedValue({
        id: 1,
        zone_id: 1,
        triggered_by: 'auto',
        started_at: fifteenMinutesAgo,
      });

      const result = await evaluateZone({ zoneId: 1, moisturePercent: 20 });

      expect(result).toEqual({ watered: true, threshold: 30 });
      expect(logIrrigationEvent).toHaveBeenCalledTimes(1);
    });

    it('a manual watering event also starts the cooldown for subsequent auto-triggers', async () => {
      getZoneById.mockResolvedValue({ id: 1, moisture_threshold: 30 });
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString();
      getMostRecentEventForZone.mockResolvedValue({
        id: 1,
        zone_id: 1,
        triggered_by: 'manual',
        started_at: oneMinuteAgo,
      });

      const result = await evaluateZone({ zoneId: 1, moisturePercent: 20 });

      expect(result.watered).toBe(false);
      expect(logIrrigationEvent).not.toHaveBeenCalled();
    });
  });
});
