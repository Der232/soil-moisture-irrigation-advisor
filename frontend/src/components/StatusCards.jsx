import { useState } from 'react';
import { dataSource } from '../data/dataSource';

function statusColor(moisture, threshold) {
  if (moisture < threshold) return 'bg-red-100 border-red-400 text-red-800';
  if (moisture < threshold + 30) return 'bg-yellow-100 border-yellow-400 text-yellow-800';
  return 'bg-green-100 border-green-400 text-green-800';
}

export default function StatusCards({ zones, readingsByZone, onWatered, onDeleted }) {
  const [wateringZoneId, setWateringZoneId] = useState(null);
  const [deletingZoneId, setDeletingZoneId] = useState(null);

  async function handleWaterNow(zoneId) {
    setWateringZoneId(zoneId);
    try {
      await dataSource.manualWater(zoneId);
      if (onWatered) onWatered(zoneId);
    } catch (err) {
      // next poll will reflect the real state
    } finally {
      setWateringZoneId(null);
    }
  }

  async function handleDelete(zoneId, zoneName) {
    if (!window.confirm(`Remove "${zoneName}"? This cannot be undone.`)) return;
    setDeletingZoneId(zoneId);
    try {
      await dataSource.deleteZone(zoneId);
      if (onDeleted) onDeleted();
    } catch (err) {
      // zone stays visible if deletion failed
    } finally {
      setDeletingZoneId(null);
    }
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {zones.map((zone) => {
        const reading = readingsByZone[zone.id];
        const moisture = reading ? reading.moisture_percent : null;
        const threshold = Number(zone.moisture_threshold ?? 30);
        return (
          <div
            key={zone.id}
            className={`border rounded-lg p-3 ${moisture !== null ? statusColor(moisture, threshold) : 'bg-gray-50 border-gray-300'}`}
          >
            <div className="flex justify-between items-start">
              <p className="font-medium text-sm">{zone.name}</p>
              <button
                onClick={() => handleDelete(zone.id, zone.name)}
                disabled={deletingZoneId === zone.id}
                className="text-xs text-red-600 hover:underline disabled:opacity-60"
                title="Remove zone"
              >
                {deletingZoneId === zone.id ? '…' : '✕'}
              </button>
            </div>
            <p className="text-2xl font-bold">
              {moisture !== null ? `${moisture}%` : '—'}
            </p>
            <p className="text-xs opacity-75">{zone.location_note}</p>
            <p className="text-xs opacity-60 mb-2">Waters below {threshold}%</p>
            <button
              onClick={() => handleWaterNow(zone.id)}
              disabled={wateringZoneId === zone.id}
              className="text-xs bg-blue-600 text-white rounded px-2 py-1 disabled:opacity-60"
            >
              {wateringZoneId === zone.id ? 'Watering…' : 'Water now'}
            </button>
          </div>
        );
      })}
    </div>
  );
}
