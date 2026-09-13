import { useEffect, useState, useCallback } from 'react';
import { dataSource } from '../data/dataSource';
import GardenScene3D from '../three/GardenScene3D';
import StatusCards from '../components/StatusCards';
import MoistureChart from '../components/MoistureChart';
import AttentionAlerts from '../components/AttentionAlerts';
import ModeBanner from '../components/ModeBanner';

export default function Dashboard() {
  const [zones, setZones] = useState([]);
  const [readingsByZone, setReadingsByZone] = useState({});
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  const loadZones = useCallback(() => {
    dataSource
      .getZones()
      .then((data) => {
        setZones(data);
        if (data.length > 0 && !selectedZoneId) setSelectedZoneId(data[0].id);
        setError('');
      })
      .catch(() => setError('Could not load zones.'));
  }, [selectedZoneId]);

  useEffect(() => {
    loadZones();
  }, [loadZones]);

  const fetchLatest = useCallback(() => {
    dataSource
      .getLatestReadings()
      .then((data) => {
        const map = {};
        data.forEach((r) => {
          map[r.zone_id] = r;
        });
        setReadingsByZone(map);
        setError('');
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchLatest();
    const interval = setInterval(fetchLatest, 4000);

    const unsub = dataSource.subscribe(() => {
      fetchLatest();
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [fetchLatest]);

  useEffect(() => {
    if (!selectedZoneId) return;
    dataSource
      .getHistory(selectedZoneId)
      .then((data) => setHistory(data))
      .catch(() => {});
  }, [selectedZoneId, readingsByZone]);

  function handleWatered(zoneId) {
    dataSource.manualWater(zoneId).then(() => {
      fetchLatest();
    });
  }

  function handleRetry() {
    dataSource.setMode('unknown');
    loadZones();
    fetchLatest();
  }

  return (
    <div className="p-6 h-screen flex flex-col">
      <h1 className="text-2xl font-semibold mb-1">Soil Moisture & Irrigation Advisor</h1>
      <p className="text-sm text-gray-500 mb-3">Live campus garden overview (simulated sensor feed)</p>
      <ModeBanner onRetry={handleRetry} />
      {error && (
        <div className="bg-red-100 border border-red-300 text-red-800 text-sm rounded-lg p-3 mb-4">
          {error}
        </div>
      )}
      <AttentionAlerts zones={zones} readingsByZone={readingsByZone} />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-0">
        <div className="min-h-[320px]">
          <GardenScene3D zones={zones} readingsByZone={readingsByZone} />
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto">
          <StatusCards zones={zones} readingsByZone={readingsByZone} onWatered={handleWatered} onDeleted={loadZones} />

          <div className="border rounded-lg p-3">
            <div className="flex justify-between items-center mb-2">
              <h2 className="font-medium text-sm">Moisture history</h2>
              <select
                className="text-sm border rounded px-2 py-1"
                value={selectedZoneId || ''}
                onChange={(e) => setSelectedZoneId(Number(e.target.value))}
              >
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name}
                  </option>
                ))}
              </select>
            </div>
            <MoistureChart history={history} />
          </div>
        </div>
      </div>
    </div>
  );
}
