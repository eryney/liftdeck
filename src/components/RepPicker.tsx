import { useState } from 'react';
import { Sheet } from './Sheet';

/**
 * Quick-select rep grid around the target range. One tap = logged.
 * "0 / FAIL" and custom entry are available for unusual values.
 * Timed exercises show seconds in 5-second steps instead of reps.
 */
export function RepPicker({
  exerciseName,
  setNumber,
  repMin,
  repMax,
  current,
  timed,
  target,
  onPick,
  onClose,
}: {
  exerciseName: string;
  setNumber: number;
  repMin: number;
  repMax: number;
  current: number | null;
  timed?: boolean;
  /** today's exact target for this set */
  target?: number;
  onPick: (reps: number) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState(false);
  const [customVal, setCustomVal] = useState('');

  const step = timed ? 5 : 1;
  const lo = Math.max(step, repMin - 3 * step);
  const hi = repMax + 2 * step;
  const options: number[] = [];
  for (let r = lo; r <= hi; r += step) options.push(r);
  const unit = timed ? 's' : '';

  return (
    <Sheet onClose={onClose}>
      <div className="spread">
        <div>
          <div className="tiny faint">{exerciseName.toUpperCase()}</div>
          <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.08em' }}>
            SET {setNumber} · {timed ? 'SECONDS' : 'REPS'}
          </div>
        </div>
        <div className="tiny dim">
          TARGET {repMin}–{repMax}{unit}
        </div>
      </div>
      {!custom ? (
        <>
          {target != null && (
            <button className="btn btn--green mt16" onClick={() => onPick(target)} aria-label={`hit target ${target}`}>
              ✓ HIT {target}{unit}
            </button>
          )}
          <div className="rep-grid">
            {options.map((r) => (
              <button
                key={r}
                className={`${r >= repMax ? 'max' : r >= repMin ? 'target' : ''}${r === target ? ' goal' : ''}`}
                onClick={() => onPick(r)}
                aria-label={`${r} ${timed ? 'seconds' : 'reps'}`}
              >
                {r}{unit}
              </button>
            ))}
          </div>
          <div className="row mt16" style={{ gap: 10 }}>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => onPick(0)}>
              0 · {timed ? 'NO HOLD' : 'FAILED'}
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
            placeholder={timed ? 'seconds' : 'reps'}
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
