import { useState } from 'react';
import { store } from '../store/store';
import { Sheet } from './Sheet';

export function CardioLog({ onClose }: { onClose: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [activity, setActivity] = useState('Walk');
  const [minutes, setMinutes] = useState('');
  const value = Number(minutes);
  const valid = Number.isFinite(value) && value >= 1 && value <= 1440;
  async function save() {
    if (!valid || saving) return;
    setSaving(true);
    setError('');
    try {
      await store.logCardio(value, activity);
      onClose();
    } catch {
      setError("Couldn't save your cardio. Try again.");
      setSaving(false);
    }
  }
  return (
    <Sheet title="Log cardio" onClose={onClose}>
      <p className="muted small">Record the cardio you've completed. This counts toward your optional sessions.</p>
      <label className="small">Activity
        <select aria-label="cardio activity" value={activity} onChange={(e) => setActivity(e.target.value)}>
          {['Walk', 'Run', 'Cycle', 'Swim', 'Other cardio'].map((a) => <option key={a}>{a}</option>)}
        </select>
      </label>
      <label className="small">Minutes completed
        <input className="mt8" type="number" inputMode="numeric" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(e.target.value)} aria-label="cardio minutes" />
      </label>
      <button className="btn btn--primary btn--block mt16" disabled={!valid || saving} onClick={save}>{saving ? 'Saving…' : 'Save cardio'}</button>
      {error && <p role="alert" className="red small">{error}</p>}
    </Sheet>
  );
}
