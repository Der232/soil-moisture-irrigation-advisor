import { useEffect, useRef, useState, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import {
  createDefaultZones,
  createReservoir,
  createZone,
  tickSimulation,
  manualWater,
} from '../simulation/irrigationEngine';

const DEFAULT_COOLDOWN_MINUTES = 10;
const DEFAULT_DAY_MINUTES = 10;
const TICK_MS = 2000;

function statusColor(moisture, threshold) {
  if (moisture === null) return 'bg-gray-100 border-gray-400 text-gray-700';
  if (moisture < threshold) return 'bg-red-100 border-red-400 text-red-800';
  if (moisture < threshold + 25) return 'bg-amber-100 border-amber-400 text-amber-800';
  return 'bg-emerald-100 border-emerald-400 text-emerald-800';
}

function statusLabel(moisture, threshold) {
  if (moisture === null) return 'Sensor disconnected';
  if (moisture < threshold) return 'DRY — needs water';
  if (moisture < threshold + 25) return 'Moderate';
  return 'Well-watered';
}

function fmtTime(ts) {
  return new Date(ts).toLocaleTimeString();
}

export default function Simulation() {
  const zonesRef = useRef(createDefaultZones());
  const reservoirRef = useRef(createReservoir());
  const [zones, setZones] = useState(zonesRef.current);
  const [running, setRunning] = useState(true);
  const [selectedZoneId, setSelectedZoneId] = useState(1);
  const [cooldownMinutes, setCooldownMinutes] = useState(DEFAULT_COOLDOWN_MINUTES);
  const [tickCount, setTickCount] = useState(0);
  const [showAddZone, setShowAddZone] = useState(false);
  const [rainfallMm, setRainfallMm] = useState(0);
  const [temperatureC, setTemperatureC] = useState(25);
  const [relativeHumidityPercent, setRelativeHumidityPercent] = useState(50);
  const [pumpFailure, setPumpFailure] = useState(false);
  const [sensorFailureZoneId, setSensorFailureZoneId] = useState('');

  const runningRef = useRef(running);
  runningRef.current = running;

  const tick = useCallback(() => {
    if (!runningRef.current) return;
    tickSimulation(zonesRef.current, {
      cooldownMinutes,
      simulatedDayMinutes: DEFAULT_DAY_MINUTES,
      reservoir: reservoirRef.current,
      rainfallMm,
      environment: { temperatureC, relativeHumidityPercent },
      pumpFailure,
      sensorFailures: sensorFailureZoneId
        ? { [sensorFailureZoneId]: 'disconnected' }
        : {},
    });
    setZones([...zonesRef.current]);
    setTickCount((c) => c + 1);
  }, [
    cooldownMinutes,
    rainfallMm,
    temperatureC,
    relativeHumidityPercent,
    pumpFailure,
    sensorFailureZoneId,
  ]);

  useEffect(() => {
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [tick]);

  const selectedZone = zones.find((z) => z.id === selectedZoneId) || zones[0];

  function handleManualWater(zoneId) {
    const zone = zonesRef.current.find((z) => z.id === zoneId);
    if (!zone) return;
    manualWater(zone, { reservoir: reservoirRef.current, pumpFailure });
    setZones([...zonesRef.current]);
  }

  function handleAddZone(data) {
    const newId = Math.max(0, ...zonesRef.current.map((z) => z.id)) + 1;
    const newZone = createZone({
      id: newId,
      name: data.name,
      locationNote: data.locationNote,
      gridX: data.gridX,
      gridY: data.gridY,
      threshold: data.threshold,
    });
    newZone.rawValue = newZone.calibration.dryRaw * 0.7;
    newZone.currentMoisture = 15;
    zonesRef.current.push(newZone);
    setZones([...zonesRef.current]);
    setShowAddZone(false);
  }

  function handleReset() {
    zonesRef.current = createDefaultZones();
    reservoirRef.current = createReservoir();
    setZones(zonesRef.current);
    setSelectedZoneId(1);
    setTickCount(0);
  }

  const allEvents = zones
    .flatMap((z) => z.events)
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 20);

  const chartData = selectedZone
    ? selectedZone.history.map((h) => ({ time: fmtTime(h.timestamp), moisture: h.moisture }))
    : [];

  const dryCount = zones.filter((z) => z.currentMoisture !== null && z.currentMoisture < z.moistureThreshold).length;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Irrigation Simulation</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setRunning((r) => !r)}
            className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
              running ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            {running ? 'Pause' : 'Resume'}
          </button>
          <button
            onClick={handleReset}
            className="text-sm px-4 py-2 rounded-lg font-medium bg-gray-200 hover:bg-gray-300 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        A self-contained simulation of the sensor-to-irrigation loop — no backend or database required.
        Each zone models a real capacitive sensor's raw ADC reading, calibration mapping, drying physics,
        and rule-based watering with per-zone thresholds and cooldown.
      </p>

      {/* Controls bar */}
      <div className="flex flex-wrap items-center gap-4 mb-4 bg-gray-50 border rounded-lg p-3">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">Cooldown (min):</label>
          <input
            type="number"
            min="1"
            max="60"
            value={cooldownMinutes}
            onChange={(e) => setCooldownMinutes(Number(e.target.value) || 1)}
            className="w-16 text-sm border rounded px-2 py-1"
          />
        </div>
        <div className="text-sm text-gray-600">
          Tick: <span className="font-mono font-medium">{tickCount}</span> · Interval: {TICK_MS / 1000}s · Simulated day: {DEFAULT_DAY_MINUTES}min
        </div>
        <div className="text-sm">
          <span className={`font-medium ${dryCount > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
            {dryCount > 0 ? `${dryCount} zone${dryCount > 1 ? 's' : ''} below threshold` : 'All zones healthy'}
          </span>
        </div>
        <label className="text-sm text-gray-700">
          Rain (mm/tick)
          <input
            type="number"
            min="0"
            max="1000"
            value={rainfallMm}
            onChange={(e) => setRainfallMm(Math.max(0, Number(e.target.value) || 0))}
            className="ml-2 w-20 text-sm border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm text-gray-700">
          Temp (°C)
          <input
            type="number"
            min="-20"
            max="60"
            value={temperatureC}
            onChange={(e) => setTemperatureC(Number(e.target.value) || 0)}
            className="ml-2 w-16 text-sm border rounded px-2 py-1"
          />
        </label>
        <label className="text-sm text-gray-700">
          RH (%)
          <input
            type="number"
            min="0"
            max="100"
            value={relativeHumidityPercent}
            onChange={(e) => setRelativeHumidityPercent(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
            className="ml-2 w-16 text-sm border rounded px-2 py-1"
          />
        </label>
        <label className="flex items-center gap-1 text-sm text-gray-700">
          <input type="checkbox" checked={pumpFailure} onChange={(e) => setPumpFailure(e.target.checked)} />
          Simulate pump failure
        </label>
        <label className="text-sm text-gray-700">
          Sensor fault
          <select
            value={sensorFailureZoneId}
            onChange={(e) => setSensorFailureZoneId(e.target.value)}
            className="ml-2 text-sm border rounded px-2 py-1"
          >
            <option value="">None</option>
            {zones.map((z) => <option key={z.id} value={z.id}>{z.name}</option>)}
          </select>
        </label>
        <div className="text-sm text-gray-600">
          Reservoir: <span className="font-medium">{reservoirRef.current.currentLevelL.toFixed(1)} L</span>
          {' '}· daily used {reservoirRef.current.dailyUsedL.toFixed(1)} L / {reservoirRef.current.dailyBudgetL} L
        </div>
        <button
          onClick={() => setShowAddZone(true)}
          className="text-sm px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors ml-auto"
        >
          Add Zone
        </button>
      </div>

      {showAddZone && (
        <AddZoneForm onSubmit={handleAddZone} onCancel={() => setShowAddZone(false)} />
      )}

      {/* Zone cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {zones.map((zone) => {
          const moisture = zone.currentMoisture;
          const threshold = zone.moistureThreshold;
          return (
            <div
              key={zone.id}
              className={`border-2 rounded-lg p-4 transition-all ${statusColor(moisture, threshold)}`}
            >
              <div className="flex justify-between items-start mb-1">
                <p className="font-medium text-sm">{zone.name}</p>
                <span className="text-xs font-mono bg-white/50 rounded px-1.5 py-0.5">
                  #{zone.id}
                </span>
              </div>
              <p className="text-3xl font-bold mb-1">{moisture === null ? '—' : `${moisture.toFixed(1)}%`}</p>
              <p className="text-xs opacity-75 mb-1">{zone.locationNote}</p>
              <p className="text-xs opacity-60 mb-2">
 Waters below {threshold}% · {statusLabel(moisture, threshold)}
              </p>
              <button
                onClick={() => handleManualWater(zone.id)}
                className="text-xs bg-blue-600 text-white rounded px-2 py-1.5 hover:bg-blue-700 transition-colors w-full"
              >
                Water now
              </button>
            </div>
          );
        })}
      </div>

      {/* Chart + Event log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="border rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h2 className="font-medium">Moisture History — {selectedZone?.name}</h2>
            <select
              className="text-sm border rounded px-2 py-1"
              value={selectedZoneId}
              onChange={(e) => setSelectedZoneId(Number(e.target.value))}
            >
              {zones.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </select>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Tooltip />
                {selectedZone && (
                  <ReferenceLine
                    y={selectedZone.moistureThreshold}
                    stroke="#ef4444"
                    strokeDasharray="5 5"
                    label={{ value: `Threshold ${selectedZone.moistureThreshold}%`, fontSize: 10, fill: "#ef4444" }}
                  />
                )}
                <Line type="monotone" dataKey="moisture" stroke="#059669" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            Red dashed line = this zone's watering threshold. When moisture drops below it and cooldown has passed, auto-watering fires.
          </p>
        </div>

        <div className="border rounded-lg p-4">
          <h2 className="font-medium mb-3">Irrigation Event Log</h2>
          {allEvents.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">
              No watering events yet. As zones dry out below their threshold, auto-watering events will appear here.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {allEvents.map((evt) => (
                <div
                  key={`${evt.zoneId}-${evt.id}`}
                  className="flex items-center justify-between text-sm border-b border-gray-100 pb-2"
                >
                  <div>
                    <span
                      className={`inline-block text-xs font-medium rounded px-2 py-0.5 mr-2 ${
                        evt.triggeredBy === 'manual'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-200 text-gray-700'
                      }`}
                    >
                      {evt.triggeredBy === 'manual' ? 'Manual' : 'Auto'}
                    </span>
                    <span className="font-medium">{evt.zoneName}</span>
                  </div>
                  <div className="text-right text-xs text-gray-500">
                    <div>Moisture before: {evt.moistureBefore === null ? '—' : `${evt.moistureBefore.toFixed(1)}%`}</div>
                    {evt.requestedVolumeL !== undefined && (
                      <div>{evt.status} · {Number(evt.requestedVolumeL).toFixed(2)} L requested</div>
                    )}
                    <div>{fmtTime(evt.timestamp)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Physics explanation */}
      <div className="mt-6 bg-gray-50 border rounded-lg p-4 text-sm text-gray-600">
        <h3 className="font-medium text-gray-800 mb-2">How this simulation works</h3>
        <ol className="list-decimal list-inside space-y-1">
          <li>Each zone stores root-zone water in millimetres between a wilting point and field capacity. Temperature, humidity, daylight, and the zone drying factor produce a transparent evapotranspiration estimate.</li>
          <li>Rainfall and retained irrigation are added to storage; excess above field capacity is reported as drainage. The pump volume and efficiency determine how much water is retained.</li>
          <li>The sensor reading is derived from storage, converted to a calibrated 12-bit ADC value, then measured with deterministic noise. A disconnected sensor cannot trigger irrigation.</li>
          <li>The advisor applies the lower threshold, target, cooldown, reservoir level, daily budget, and optional pump-failure rule. Events distinguish completed and blocked watering.</li>
        </ol>
      </div>
    </div>
  );
}

function AddZoneForm({ onSubmit, onCancel }) {
  const [name, setName] = useState('');
  const [locationNote, setLocationNote] = useState('');
  const [gridX, setGridX] = useState(0);
  const [gridY, setGridY] = useState(0);
  const [threshold, setThreshold] = useState(30);

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSubmit({ name: name.trim(), locationNote, gridX: Number(gridX), gridY: Number(gridY), threshold: Number(threshold) });
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit} className="bg-white rounded-xl p-6 w-96 shadow-lg">
        <h2 className="text-lg font-semibold mb-4">Add Simulated Zone</h2>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Zone name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Zone E — Strawberry bed"
              className="w-full text-sm border rounded px-3 py-2"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Location note</label>
            <input
              type="text"
              value={locationNote}
              onChange={(e) => setLocationNote(e.target.value)}
              placeholder="e.g. West greenhouse"
              className="w-full text-sm border rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Grid X</label>
              <input
                type="number"
                value={gridX}
                onChange={(e) => setGridX(e.target.value)}
                className="w-full text-sm border rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">Grid Y</label>
              <input
                type="number"
                value={gridY}
                onChange={(e) => setGridY(e.target.value)}
                className="w-full text-sm border rounded px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Moisture threshold (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="w-full text-sm border rounded px-3 py-2"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button type="button" onClick={onCancel} className="text-sm px-4 py-2 rounded-lg bg-gray-200 hover:bg-gray-300">
            Cancel
          </button>
          <button type="submit" className="text-sm px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700">
            Add Zone
          </button>
        </div>
      </form>
    </div>
  );
}
