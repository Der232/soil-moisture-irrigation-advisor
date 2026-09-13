import { useEffect, useState, useCallback } from 'react';
import { dataSource } from '../data/dataSource';
import ModeBanner from '../components/ModeBanner';

function triggerBadge(triggeredBy) {
  return triggeredBy === 'manual'
    ? 'bg-blue-100 text-blue-800'
    : 'bg-gray-100 text-gray-700';
}

export default function IrrigationLog() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState('');

  const loadEvents = useCallback(() => {
    dataSource
      .getEvents()
      .then((data) => {
        setEvents(data);
        setError('');
      })
      .catch(() => setError('Could not load irrigation history.'));
  }, []);

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 6000);

    const unsub = dataSource.subscribe(() => {
      loadEvents();
    });

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, [loadEvents]);

  function handleRetry() {
    dataSource.setMode('unknown');
    loadEvents();
  }

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-semibold mb-1">Irrigation Event Log</h1>
      <p className="text-sm text-gray-500 mb-3">History of automatic and manual watering across all zones.</p>
      <ModeBanner onRetry={handleRetry} />
      {error && <p className="text-red-600 text-sm mb-2">{error}</p>}

      <table className="w-full text-sm border">
        <thead>
          <tr className="bg-gray-100 text-left">
            <th className="p-2 border">Zone</th>
            <th className="p-2 border">Trigger</th>
            <th className="p-2 border">Moisture Before</th>
            <th className="p-2 border">Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td className="p-2 border">{e.zone_name}</td>
              <td className="p-2 border">
                <span className={`text-xs px-2 py-1 rounded ${triggerBadge(e.triggered_by)}`}>
                  {e.triggered_by}
                </span>
              </td>
              <td className="p-2 border">
                {e.moisture_before !== null ? `${e.moisture_before}%` : '—'}
              </td>
              <td className="p-2 border text-gray-500">
                {new Date(e.started_at).toLocaleString()}
              </td>
            </tr>
          ))}
          {events.length === 0 && !error && (
            <tr>
              <td colSpan={4} className="p-3 text-center text-gray-400">
                No irrigation events yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
