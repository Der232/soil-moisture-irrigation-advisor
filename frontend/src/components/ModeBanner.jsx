import { useEffect, useState } from 'react';
import { dataSource } from '../data/dataSource';

/**
 * Shows a small banner indicating whether data is coming from the live
 * backend or the built-in browser simulation, with a retry button to
 * attempt reconnecting to the backend.
 */
export default function ModeBanner({ onRetry }) {
  const [mode, setMode] = useState(dataSource.getMode());

  useEffect(() => {
    const unsub = dataSource.subscribe(() => {
      const m = dataSource.getMode();
      setMode(m);
    });

    const interval = setInterval(() => {
      const m = dataSource.getMode();
      setMode(m);
    }, 3000);

    return () => {
      unsub();
      clearInterval(interval);
    };
  }, []);

  if (mode === 'live') {
    return (
      <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-lg px-3 py-1.5 mb-3 flex items-center gap-2">
        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
        Live backend connected
      </div>
    );
  }

  if (mode === 'simulation') {
    return (
      <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs rounded-lg px-3 py-1.5 mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
          Offline simulation mode — backend not running, using built-in simulator
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="text-amber-700 underline hover:text-amber-900 font-medium"
          >
            Retry backend
          </button>
        )}
      </div>
    );
  }

  return null;
}
