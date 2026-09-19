function formatLitres(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number.toFixed(1)} L` : '—';
}

export default function SystemOverview({ status, zones, readingsByZone }) {
  if (!status) return null;

  const reservoir = status.reservoir;
  const readings = Object.values(readingsByZone);
  const activeCount = readings.filter((reading) => reading.irrigation_active === true).length;
  const disconnectedCount = readings.filter((reading) => (
    ['disconnected', 'out_of_range'].includes(reading.sensor_status)
  )).length;
  const blockedEvents = (status.recentEvents || []).filter((event) => (
    ['blocked', 'failed'].includes(event.status)
  ));
  const capacity = reservoir?.capacity_l ?? reservoir?.capacityL;
  const currentLevel = reservoir?.current_level_l ?? reservoir?.currentLevelL;
  const reservoirPercent = reservoir && Number(capacity) > 0
    ? Math.round(Number(currentLevel) / Number(capacity) * 100)
    : null;

  return (
    <section className="grid grid-cols-2 xl:grid-cols-5 gap-3" aria-label="System overview">
      <div className="border rounded-lg p-3 bg-white">
        <p className="text-xs text-gray-500">Operating mode</p>
        <p className="font-semibold capitalize">{status.mode || '—'}</p>
        <p className="text-xs text-gray-400 mt-1">
          {status.sensorDataNote || 'Data provenance is shown per reading.'}
        </p>
      </div>
      <div className="border rounded-lg p-3 bg-white">
        <p className="text-xs text-gray-500">Reservoir</p>
        <p className="font-semibold">
          {reservoir ? formatLitres(currentLevel) : '—'}
        </p>
        <p className="text-xs text-gray-400 mt-1">
          {reservoirPercent === null ? 'Not configured' : `${reservoirPercent}% of capacity`}
        </p>
      </div>
      <div className="border rounded-lg p-3 bg-white">
        <p className="text-xs text-gray-500">Active irrigation</p>
        <p className="font-semibold">{activeCount} zone{activeCount === 1 ? '' : 's'}</p>
        <p className="text-xs text-gray-400 mt-1">Explicit event state only</p>
      </div>
      <div className={`border rounded-lg p-3 bg-white ${disconnectedCount ? 'border-red-300' : ''}`}>
        <p className="text-xs text-gray-500">Sensor communication</p>
        <p className="font-semibold">
          {disconnectedCount ? `${disconnectedCount} issue${disconnectedCount === 1 ? '' : 's'}` : 'Nominal'}
        </p>
        <p className="text-xs text-gray-400 mt-1">{readings.length} of {zones.length} zones reporting</p>
      </div>
      <div className={`border rounded-lg p-3 bg-white ${blockedEvents.length ? 'border-amber-300' : ''}`}>
        <p className="text-xs text-gray-500">Recent safety events</p>
        <p className="font-semibold">{blockedEvents.length}</p>
        <p className="text-xs text-gray-400 mt-1">
          {blockedEvents[0]?.reason || 'No blocked or failed actions'}
        </p>
      </div>
    </section>
  );
}