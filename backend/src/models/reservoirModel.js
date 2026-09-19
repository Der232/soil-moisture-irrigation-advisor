const db = require('../config/db');

function todaySql() {
  return new Date().toISOString().slice(0, 10);
}

async function getReservoir() {
  const [rows] = await db.query('SELECT * FROM reservoir_state WHERE id = 1');
  if (!rows[0]) return null;

  const reservoir = rows[0];
  const today = todaySql();
  if (String(reservoir.budget_date).slice(0, 10) !== today) {
    await db.query(
      'UPDATE reservoir_state SET daily_used_l = 0, budget_date = ? WHERE id = 1',
      [today]
    );
    reservoir.daily_used_l = 0;
    reservoir.budget_date = today;
  }
  return reservoir;
}

/**
 * Atomically reserves pump-delivered water for one irrigation action.
 * A reservation is also the accounting point for the simulation: it does
 * not claim that a physical pump moved water.
 */
async function reserveWater(volumeL) {
  const requested = Math.max(0, Number(volumeL));
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    const [rows] = await connection.query(
      'SELECT * FROM reservoir_state WHERE id = 1 FOR UPDATE'
    );
    const reservoir = rows[0];
    if (!reservoir) {
      await connection.rollback();
      return { approved: false, reason: 'Reservoir is not configured' };
    }

    const today = todaySql();
    let dailyUsed = Number(reservoir.daily_used_l);
    if (String(reservoir.budget_date).slice(0, 10) !== today) dailyUsed = 0;

    if (Number(reservoir.current_level_l) < requested) {
      await connection.rollback();
      return {
        approved: false,
        reason: 'Insufficient reservoir water',
        availableVolumeL: Number(reservoir.current_level_l),
        requestedVolumeL: requested,
      };
    }

    if (dailyUsed + requested > Number(reservoir.daily_budget_l)) {
      await connection.rollback();
      return {
        approved: false,
        reason: 'Daily water budget exceeded',
        remainingBudgetL: Math.max(0, Number(reservoir.daily_budget_l) - dailyUsed),
        requestedVolumeL: requested,
      };
    }

    await connection.query(
      `UPDATE reservoir_state
       SET current_level_l = current_level_l - ?,
           daily_used_l = ?,
           budget_date = ?
       WHERE id = 1`,
      [requested, dailyUsed + requested, today]
    );
    await connection.commit();

    return {
      approved: true,
      requestedVolumeL: requested,
      remainingVolumeL: Number(reservoir.current_level_l) - requested,
      remainingBudgetL: Number(reservoir.daily_budget_l) - dailyUsed - requested,
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function updateReservoir({ capacityL, currentLevelL, dailyBudgetL }) {
  const capacity = Math.max(0, Number(capacityL));
  const current = Math.min(capacity, Math.max(0, Number(currentLevelL)));
  const budget = Math.max(0, Number(dailyBudgetL));

  await db.query(
    `UPDATE reservoir_state
     SET capacity_l = ?, current_level_l = ?, daily_budget_l = ?
     WHERE id = 1`,
    [capacity, current, budget]
  );
  return getReservoir();
}

module.exports = { getReservoir, reserveWater, updateReservoir };