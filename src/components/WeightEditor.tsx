import { useState } from 'react';
import { Sheet } from './Sheet';
import { fmtWeightFull, trimNum } from '../lib/format';

/** Added load on top of bodyweight: a loaded backpack, a weight vest, a dip belt. */
export function WeightEditor({
  name,
  weight,
  increment,
  suggested,
  unit,
  onSave,
  onClose,
}: {
  name: string;
  weight: number;
  increment: number;
  suggested: number;
  unit: string;
  onSave: (w: number) => void;
  onClose: () => void;
}) {
  const [w, setW] = useState(weight);
  const step = increment || 5;

  return (
    <Sheet onClose={onClose}>
      <div className="eyebrow">{name}</div>
      <h3>Added load</h3>
      <div className="row mt16" style={{ justifyContent: 'center', gap: 16 }}>
        <div className="stepper">
          <button onClick={() => setW(Math.max(0, Math.round((w - step) * 10) / 10))} aria-label="decrease">
            −
          </button>
          <div className="val" style={{ minWidth: 110, fontSize: 30 }}>{w === 0 ? 'BW' : `+${trimNum(w)}`}</div>
          <button onClick={() => setW(Math.round((w + step) * 10) / 10)} aria-label="increase">
            +
          </button>
        </div>
      </div>
      <div className="center muted small mt8">{fmtWeightFull({ weight: w }, unit)}</div>
      <div className="center faint tiny mt4">Step {trimNum(step)} {unit} · suggested {suggested === 0 ? 'bodyweight' : `+${trimNum(suggested)}`}</div>
      <p className="faint tiny center mt8" style={{ margin: '8px 0 0' }}>
        A backpack with books or water bottles works. Targets restart at the floor of the range on a new load.
      </p>
      <div className="mt16">
        <input
          type="number"
          inputMode="decimal"
          value={String(w)}
          onChange={(e) => setW(Math.max(0, Number(e.target.value) || 0))}
          aria-label="added weight"
        />
      </div>
      <div className="row mt16">
        {w !== suggested && (
          <button className="btn btn--ghost grow" onClick={() => setW(suggested)}>
            Use suggested
          </button>
        )}
        <button className="btn btn--primary" style={{ flex: 2, minHeight: 52 }} onClick={() => onSave(w)}>
          Set load
        </button>
      </div>
    </Sheet>
  );
}
