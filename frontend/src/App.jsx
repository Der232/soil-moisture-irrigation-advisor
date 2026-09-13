import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Simulation from './pages/Simulation';
import CreateZone from './pages/CreateZone';
import About from './pages/About';
import IrrigationLog from './pages/IrrigationLog';
import HardwareDemo from './pages/HardwareDemo';

export default function App() {
  const [view, setView] = useState('simulation');
  const [refreshKey, setRefreshKey] = useState(0);

  const tabBase = 'text-sm px-3 py-1 rounded transition-colors';

  return (
    <div>
      <div className="flex gap-2 px-6 pt-4 flex-wrap">
        <button
          className={`${tabBase} ${view === 'simulation' ? 'bg-emerald-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          onClick={() => setView('simulation')}
        >
          Simulation
        </button>
        <button
          className={`${tabBase} ${view === 'hardware-demo' ? 'bg-emerald-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          onClick={() => setView('hardware-demo')}
        >
          Hardware Demo
        </button>
        <button
          className={`${tabBase} ${view === 'dashboard' ? 'bg-emerald-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          onClick={() => setView('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`${tabBase} ${view === 'create-zone' ? 'bg-emerald-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          onClick={() => setView('create-zone')}
        >
          Add Zone
        </button>
        <button
          className={`${tabBase} ${view === 'log' ? 'bg-emerald-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          onClick={() => setView('log')}
        >
          Irrigation Log
        </button>
        <button
          className={`${tabBase} ${view === 'about' ? 'bg-emerald-700 text-white' : 'bg-gray-100 hover:bg-gray-200'}`}
          onClick={() => setView('about')}
        >
          About
        </button>
      </div>

      {view === 'simulation' && <Simulation />}
      {view === 'hardware-demo' && <HardwareDemo />}
      {view === 'dashboard' && <Dashboard key={refreshKey} />}
      {view === 'create-zone' && <CreateZone onCreated={() => setRefreshKey((k) => k + 1)} />}
      {view === 'log' && <IrrigationLog />}
      {view === 'about' && <About />}
    </div>
  );
}
