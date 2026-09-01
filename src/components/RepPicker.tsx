import { useState } from 'react';
import { Sheet } from './Sheet';

/**
 * Quick-select rep grid around the target range. One tap = logged.
 * "0 / FAIL" and custom entry are available for unusual values.
 */
export function RepPicker({
  exerciseName,
  setNumber,
  repMin,
  repMax,
  current,
  onPick,
  onClose,
}: {
  exerciseName: string;
  setNumber: number;
  repMin: number;
  repMax: number;
  current: number | null;
  onPick: (reps: number) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState('');

  const lo = Math.max(1, repMin - 3);
  const hi = repMax + 2;
  const options: number[] = [];
  for (let r = lo; r <= hi; r++) options.push(r);

  return (
    <Sheet onClose={onClose}>
      <div className="spread">
        <div>
          <div className="tiny faint">{exerciseName.toUpperCase()}</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.08em' }}>
            SET {setNumber} · REPS
          </div>
        </div>
        <div className="tiny dim">
          TARGET {repMin}–{repMax}
        </div>
      </div>
      {!custom ? (
        <>
          <div className="rep-grid">
            {options.map((r) => (
              <button
                key={r}
                className={r >= repMax ? 'max' : r >= repMin ? 'target' : ''}
                onClick={() => onPick(r)}
                aria-label={`${r} reps`}
              >
                {r}
              </button>
            ))}
          </div>
          <div className="row mt16" style={{ gap: 10 }}>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => onPick(0)}>
              0 · FAILED
            </button>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setCustom(true)}>
              OTHER…
            </button>
            {current != null && (
              <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onClose}>
                KEEP {current}
              </button>
            )}
          </div>
        </>
      ) : (
        <div className="mt16">
          <input
            type="number"
            inputMode="numeric"
            autoFocus
            placeholder="reps"
            value={customVal}
            onChange={(e) => setCustomVal(e.target.value)}
          />
          <div className="row mt8" style={{ gap: 10 }}>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setCustom(false)}>
              BACK
            </button>
            <button
              className="btn btn--primary"
              style={{ flex: 2, minHeight: 48 }}
              disabled={customVal === '' || Number(customVal) < 0}
              onClick={() => onPick(Math.floor(Number(customVal)))}
            >
              LOG {customVal || '—'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
