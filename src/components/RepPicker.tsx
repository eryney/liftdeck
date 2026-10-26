import { useState } from 'react';
import { Sheet } from './Sheet';

/**
 * Quick-select grid around the rep range. One tap logs the number.
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
          <div className="eyebrow">{exerciseName}</div>
          <h3>Set {setNumber} · {timed ? 'seconds held' : 'reps'}</h3>
        </div>
        <span className="pill">range {repMin}–{repMax}{unit}</span>
      </div>
      {!custom ? (
        <>
          {target != null && (
            <button className="btn btn--green btn--block mt16" onClick={() => onPick(target)} aria-label={`hit target ${target}`}>
              ✓ Hit {target}{unit}
            </button>
          )}
          <div className="rep-grid">
            {options.map((r) => (
              <button
                key={r}
                className={`${r >= repMin ? 'in-range' : 'below'}${r === target ? ' goal' : ''}${r === repMax ? ' max' : ''}`}
                onClick={() => onPick(r)}
                aria-label={`${r} ${timed ? 'seconds' : 'reps'}`}
              >
                {r}{unit}
              </button>
            ))}
          </div>
          <div className="row mt16">
            <button className="btn btn--ghost grow" onClick={() => onPick(0)}>
              0 · {timed ? 'no hold' : 'failed'}
            </button>
            <button className="btn btn--ghost grow" onClick={() => setCustom(true)}>
              Other…
            </button>
            {current != null && (
              <button className="btn btn--ghost grow" onClick={onClose}>
                Keep {current}
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
          <div className="row mt8">
            <button className="btn btn--ghost grow" onClick={() => setCustom(false)}>
              Back
            </button>
            <button
              className="btn btn--primary"
              style={{ flex: 2, minHeight: 50 }}
              disabled={customVal === '' || Number(customVal) < 0}
              onClick={() => onPick(Math.floor(Number(customVal)))}
            >
              Log {customVal || '—'}
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
