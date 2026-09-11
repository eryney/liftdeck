import { useState } from 'react';
import { Sheet } from './Sheet';
import { store } from '../store/store';
import type { BoxingAttendance, BoxingSessionType } from '../types';
import { BOXING_TYPES, boxingLoad } from '../lib/boxing';

const DURATIONS = [45, 60, 75, 90];

/**
 * Optional metadata for a boxing session. Every tap saves immediately, so dismissing at any point
 * keeps whatever was entered. Nothing here is required and nothing here affects adherence.
 */
export function BoxingDetailsSheet({ record, title = 'ADD DETAILS?', onClose }: { record: BoxingAttendance; title?: string; onClose: () => void }) {
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState('');
  const load = boxingLoad(record);

  function setType(t: BoxingSessionType) {
    store.updateBoxing(record.id, { sessionType: record.sessionType === t ? undefined : t });
  }
  function setDuration(d: number | undefined) {
    store.updateBoxing(record.id, { durationMin: d });
    setCustom(false);
  }
  function setRpe(r: number) {
    store.updateBoxing(record.id, { rpe: record.rpe === r ? undefined : r });
  }

  return (
    <Sheet onClose={onClose}>
      <div className="spread">
        <div>
          <div className="tiny faint">BOXING · {record.date}</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.08em' }}>{title}</div>
        </div>
        <button className="btn btn--ghost btn--small" onClick={onClose}>SKIP</button>
      </div>
      <div className="tiny faint mt8">All optional. Attendance is already saved.</div>

      <div className="tiny dim mt16">TYPE</div>
      <div className="chip-row mt8" role="group" aria-label="session type">
        {BOXING_TYPES.map((t) => (
          <button key={t.id} className={`chip ${record.sessionType === t.id ? 'on' : ''}`} onClick={() => setType(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="tiny dim mt16">DURATION (MIN)</div>
      <div className="chip-row mt8" role="group" aria-label="duration">
        {DURATIONS.map((d) => (
          <button key={d} className={`chip ${record.durationMin === d ? 'on' : ''}`} onClick={() => setDuration(record.durationMin === d ? undefined : d)}>
            {d}
          </button>
        ))}
        <button className={`chip ${custom || (record.durationMin != null && !DURATIONS.includes(record.durationMin)) ? 'on' : ''}`} onClick={() => setCustom(true)}>
          {record.durationMin != null && !DURATIONS.includes(record.durationMin) && !custom ? record.durationMin : 'CUSTOM'}
        </button>
      </div>
      {custom && (
        <div className="row mt8" style={{ gap: 8 }}>
          <input type="number" inputMode="numeric" placeholder="minutes" value={customVal} onChange={(e) => setCustomVal(e.target.value)} aria-label="custom duration" autoFocus />
          <button className="btn btn--small" disabled={!customVal || Number(customVal) <= 0} onClick={() => setDuration(Math.round(Number(customVal)))}>
            SET
          </button>
        </div>
      )}

      <div className="tiny dim mt16">RPE</div>
      <div className="rpe-grid mt8" role="group" aria-label="rpe">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((r) => (
          <button key={r} className={`chip ${record.rpe === r ? 'on' : ''}`} onClick={() => setRpe(r)} aria-label={`rpe ${r}`}>
            {r}
          </button>
        ))}
      </div>

      <div className="spread mt16">
        <span className="tiny faint">{load != null ? `LOAD ${load} (min × RPE)` : 'load appears once duration + RPE are set'}</span>
        <button className="btn btn--primary" style={{ width: 'auto', minHeight: 48, padding: '0 22px' }} onClick={onClose}>
          DONE
        </button>
      </div>
    </Sheet>
  );
}
