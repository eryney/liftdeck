import { useState } from 'react';
import { Sheet } from './Sheet';
import { fmtWeightFull, trimNum } from '../lib/format';

export function WeightEditor({
  name,
  weight,
  increment,
  suggested,
  bodyweight,
  perHand,
  unit,
  onSave,
  onClose,
}: {
  name: string;
  weight: number;
  increment: number;
  suggested: number;
  bodyweight?: boolean;
  perHand?: boolean;
  unit: string;
  onSave: (w: number) => void;
  onClose: () => void;
}) {
  const [w, setW] = useState(weight);
  const step = increment || 5;
  const label = fmtWeightFull({ weight: w, bodyweight, perHand }, unit);

  return (
    <Sheet onClose={onClose}>
      <div className="tiny faint">{name.toUpperCase()}</div>
      <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.08em' }}>
        {bodyweight ? 'ADDED WEIGHT' : 'WORKING WEIGHT'}
      </div>
      <div className="row mt16" style={{ justifyContent: 'center', gap: 16 }}>
        <div className="stepper">
          <button onClick={() => setW(Math.max(0, Math.round((w - step) * 10) / 10))} aria-label="decrease">
            −
          </button>
          <div className="weight-display" style={{ minWidth: 130, textAlign: 'center' }}>
            {label.split(' ')[0] === 'BODYWEIGHT' ? 'BW' : trimNum(w)}
          </div>
          <button onClick={() => setW(Math.round((w + step) * 10) / 10)} aria-label="increase">
            +
          </button>
        </div>
      </div>
      <div className="center dim small mt8">{label}</div>
      <div className="center faint tiny mt8">
        STEP {trimNum(step)} {unit.toUpperCase()} · SUGGESTED {trimNum(suggested)}
      </div>
      <div className="mt16">
        <input
          type="number"
          inputMode="decimal"
          value={String(w)}
          onChange={(e) => setW(Math.max(0, Number(e.target.value) || 0))}
          aria-label="weight"
        />
      </div>
      <div className="row mt16" style={{ gap: 10 }}>
        {w !== suggested && (
          <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setW(suggested)}>
            USE SUGGESTED
          </button>
        )}
        <button className="btn btn--primary" style={{ flex: 2, minHeight: 52 }} onClick={() => onSave(w)}>
          SET WEIGHT
        </button>
      </div>
    </Sheet>
  );
}
