import { useState } from 'react';
import { dataSource } from '../data/dataSource';

export default function CreateZone({ onCreated }) {
  const [form, setForm] = useState({ name: '', locationNote: '', gridX: 0, gridY: 0, moistureThreshold: 30 });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!form.name) {
      setError('Zone name is required.');
      return;
    }

    setSubmitting(true);
    try {
      await dataSource.createZone({
        name: form.name,
        locationNote: form.locationNote,
        gridX: Number(form.gridX),
        gridY: Number(form.gridY),
        moistureThreshold: Number(form.moistureThreshold),
      });
      setMessage(`Zone "${form.name}" created.`);
      setForm({ name: '', locationNote: '', gridX: 0, gridY: 0, moistureThreshold: 30 });
      if (onCreated) onCreated();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create zone.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-md mx-auto">
      <h1 className="text-2xl font-semibold mb-4">Add Garden Zone</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <input
          type="text"
          placeholder="Zone name (e.g. Zone E - Rooftop Beds)"
          className="border rounded px-3 py-2"
          value={form.name}
          onChange={(e) => update('name', e.target.value)}
        />
        <input
          type="text"
          placeholder="Location note (optional)"
          className="border rounded px-3 py-2"
          value={form.locationNote}
          onChange={(e) => update('locationNote', e.target.value)}
        />
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm text-gray-600">Grid X (3D scene position)</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={form.gridX}
              onChange={(e) => update('gridX', e.target.value)}
            />
          </div>
          <div className="flex-1">
            <label className="text-sm text-gray-600">Grid Y (3D scene position)</label>
            <input
              type="number"
              className="border rounded px-3 py-2 w-full"
              value={form.gridY}
              onChange={(e) => update('gridY', e.target.value)}
            />
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-600">
            Watering threshold (% moisture below which this zone gets auto-watered)
          </label>
          <input
            type="number"
            min="0"
            max="100"
            className="border rounded px-3 py-2 w-full"
            value={form.moistureThreshold}
            onChange={(e) => update('moistureThreshold', e.target.value)}
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {message && <p className="text-emerald-700 text-sm">{message}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="bg-emerald-700 text-white rounded py-2 disabled:opacity-60"
        >
          {submitting ? 'Adding…' : 'Add Zone'}
        </button>
      </form>
    </div>
  );
}
