/**
 * Data source abstraction: tries the real backend API first, falls back
 * to the in-browser simulation store when the backend is unreachable.
 *
 * Every method returns a Promise and tracks whether data came from the
 * live server or the simulation so the UI can show a mode banner.
 */
import api from '../api/client';
import { simStore } from './simStore';

let mode = 'unknown'; // 'live' | 'simulation' | 'unknown'

function shouldFallbackToSim(err) {
  if (!err.response) return true;
  if (err.code === 'ECONNABORTED' || err.message === 'Network Error') return true;
  if (err.response.status >= 500) return true;
  return false;
}

export const dataSource = {
  getMode() {
    return mode;
  },

  setMode(m) {
    mode = m;
  },

  async getZones() {
    try {
      const res = await api.get('/zones');
      mode = 'live';
      return res.data;
    } catch (err) {
      if (shouldFallbackToSim(err)) {
        mode = 'simulation';
        return simStore.getZones();
      }
      throw err;
    }
  },

  async getLatestReadings() {
    try {
      const res = await api.get('/readings/latest');
      mode = 'live';
      return res.data;
    } catch (err) {
      if (shouldFallbackToSim(err)) {
        mode = 'simulation';
        return simStore.getLatestReadings();
      }
      throw err;
    }
  },

  async getHistory(zoneId) {
    try {
      const res = await api.get(`/readings/history/${zoneId}`);
      mode = 'live';
      return res.data;
    } catch (err) {
      if (shouldFallbackToSim(err)) {
        mode = 'simulation';
        return simStore.getHistory(zoneId);
      }
      throw err;
    }
  },

  async getEvents() {
    try {
      const res = await api.get('/irrigation-events');
      mode = 'live';
      return res.data;
    } catch (err) {
      if (shouldFallbackToSim(err)) {
        mode = 'simulation';
        return simStore.getEvents();
      }
      throw err;
    }
  },

  async getSystemStatus() {
    try {
      const res = await api.get('/system/status');
      mode = 'live';
      return res.data;
    } catch (err) {
      if (shouldFallbackToSim(err)) {
        mode = 'simulation';
        return simStore.getSystemStatus();
      }
      throw err;
    }
  },

  async createZone(data) {
    try {
      const res = await api.post('/zones', data);
      mode = 'live';
      return res.data;
    } catch (err) {
      if (shouldFallbackToSim(err)) {
        mode = 'simulation';
        return simStore.addZone(data);
      }
      throw err;
    }
  },

  async deleteZone(zoneId) {
    try {
      await api.delete(`/zones/${zoneId}`);
      mode = 'live';
    } catch (err) {
      if (shouldFallbackToSim(err)) {
        mode = 'simulation';
        simStore.deleteZone(zoneId);
        return;
      }
      throw err;
    }
  },

  async manualWater(zoneId) {
    try {
      await api.post('/irrigation-events/manual', { zoneId });
      mode = 'live';
    } catch (err) {
      if (shouldFallbackToSim(err)) {
        mode = 'simulation';
        simStore.manualWater(zoneId);
        return;
      }
      throw err;
    }
  },

  subscribe(fn) {
    return simStore.subscribe(fn);
  },
};
