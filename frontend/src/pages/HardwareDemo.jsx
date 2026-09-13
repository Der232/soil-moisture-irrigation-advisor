import { useEffect, useRef, useState } from 'react';
import HardwareRig3D from '../three/HardwareRig3D';
import { simStore } from '../data/simStore';

/**
 * Hardware Demo page: shows the realistic 3D rig alongside a
 * step-by-step explanation of the sense-decide-water loop and
 * a wiring table. The 3D scene's watering animation is driven
 * by the live simulation so it reflects real moisture levels.
 */
export default function HardwareDemo() {
  const [running, setRunning] = useState(true);
  const [moisture, setMoisture] = useState(50);
  const [watering, setWatering] = useState(false);
  const runningRef = useRef(running);
  runningRef.current = running;

  useEffect(() => {
    const unsub = simStore.subscribe(() => {
      if (!runningRef.current) return;
      const zones = simStore.getZones();
      if (zones.length > 0) {
        // Use first zone's live moisture to drive the 3D scene
        const readings = simStore.getLatestReadings();
        const firstReading = readings[0];
        if (firstReading) {
          setMoisture(firstReading.moisture_percent);
          const threshold = zones[0].moisture_threshold;
          setWatering(firstReading.moisture_percent < threshold);
        }
      }
    });
    return unsub;
  }, []);

  function handleManualWater() {
    const zones = simStore.getZones();
    if (zones.length > 0) {
      simStore.manualWater(zones[0].id);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-semibold">Hardware Demo — 3D Rig</h1>
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
            onClick={handleManualWater}
            className="text-sm px-4 py-2 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
          >
            Trigger Watering
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Interactive 3D model of the complete hardware setup. Drag to rotate, scroll to zoom, and hover over any component to see its name.
        The soil darkens and water flows when the simulation triggers watering.
      </p>

      {/* Status indicators */}
      <div className="flex gap-4 mb-4 text-sm">
        <div className="bg-gray-50 border rounded-lg px-3 py-2">
          <span className="text-gray-500">Live moisture: </span>
          <span className={`font-bold ${moisture < 30 ? 'text-red-600' : 'text-emerald-600'}`}>
            {moisture.toFixed(1)}%
          </span>
        </div>
        <div className="bg-gray-50 border rounded-lg px-3 py-2">
          <span className="text-gray-500">Pump status: </span>
          <span className={`font-bold ${watering ? 'text-blue-600' : 'text-gray-400'}`}>
            {watering ? 'RUNNING' : 'Idle'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3D scene */}
        <div className="lg:col-span-2 border rounded-lg overflow-hidden" style={{ height: '480px' }}>
          <HardwareRig3D watering={watering} moisture={moisture} />
        </div>

        {/* Side panel: explanation + wiring */}
        <div className="flex flex-col gap-4">
          <div className="border rounded-lg p-4">
            <h2 className="font-medium mb-3">How the system works</h2>
            <ol className="text-sm space-y-3 text-gray-700">
              <li className="flex gap-2">
                <span className="font-bold text-emerald-700">1.</span>
                <span><b>Sense:</b> The capacitive probe in the soil measures moisture as a raw analog value (0-4095). The ESP32 reads this via its ADC pin.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-700">2.</span>
                <span><b>Decide:</b> The ESP32 sends the reading to the backend. The advisor checks if moisture is below the zone's threshold and if the cooldown window has passed.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-700">3.</span>
                <span><b>Act:</b> If watering is needed, the backend returns <code className="text-xs bg-gray-100 px-1 rounded">watered: true</code>. The ESP32 energizes the relay, which switches power to the pump.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-700">4.</span>
                <span><b>Water:</b> The pump runs for a few seconds, pushing water from the reservoir through the tube into the soil. Moisture rises and the cycle repeats.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-700">5.</span>
                <span><b>Cooldown:</b> After watering, a cooldown period prevents re-triggering on every reading — giving water time to absorb into the soil.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-emerald-700">6.</span>
                <span><b>Power-gate:</b> The sensor is only powered during the brief reading window, extending its lifespan and reducing power consumption.</span>
              </li>
            </ol>
          </div>

          <div className="border rounded-lg p-4">
            <h2 className="font-medium mb-3">Wiring connections</h2>
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-100 text-left">
                  <th className="p-2 border">From</th>
                  <th className="p-2 border">To</th>
                  <th className="p-2 border">Wire</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="p-2 border">Sensor VCC</td>
                  <td className="p-2 border">ESP32 3.3V</td>
                  <td className="p-2 border text-red-600">Red</td>
                </tr>
                <tr>
                  <td className="p-2 border">Sensor GND</td>
                  <td className="p-2 border">ESP32 GND</td>
                  <td className="p-2 border">Black</td>
                </tr>
                <tr>
                  <td className="p-2 border">Sensor AOUT</td>
                  <td className="p-2 border">ESP32 GPIO34 (ADC1)</td>
                  <td className="p-2 border text-yellow-600">Yellow</td>
                </tr>
                <tr>
                  <td className="p-2 border">ESP32 GPIO26</td>
                  <td className="p-2 border">Relay IN</td>
                  <td className="p-2 border text-orange-600">Orange</td>
                </tr>
                <tr>
                  <td className="p-2 border">Relay COM/NO</td>
                  <td className="p-2 border">Pump power</td>
                  <td className="p-2 border text-green-600">Green</td>
                </tr>
                <tr>
                  <td className="p-2 border">Pump supply</td>
                  <td className="p-2 border">Relay (switched)</td>
                  <td className="p-2 border text-gray-500">Power</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
