import { useState } from 'react';
import { store, useAppState } from '../store/store';
import { PLAN_ID } from '../data/seedPlan';
import { applyCalibration, DEFAULT_CALIBRATION } from '../lib/calibrate';
import type { Calibration, PullLevel, PushLevel, SquatLevel } from '../lib/calibrate';

export function Onboarding({ onDone }: { onDone: () => void }) {
  const state = useAppState();
  const [step, setStep] = useState<0 | 1>(0);
  const [c, setC] = useState<Calibration>(DEFAULT_CALIBRATION);
  const plan = state.plans.find((p) => p.id === PLAN_ID) ?? state.plans[0];

  function finish(calibrate: boolean) {
    if (calibrate && plan) {
      const ids = new Set(plan.weeklyGoals.flatMap((g) => (g.kind === 'rotation' ? g.templateIds : [g.templateId])));
      const tpls = state.templates.filter((t) => ids.has(t.id));
      for (const t of applyCalibration(tpls, c)) store.saveTemplate(t);
    }
    store.completeOnboarding(plan?.id ?? null);
    onDone();
  }

  if (step === 1) {
    return (
      <div className="screen">
        <div className="eyebrow">Step 2 of 2</div>
        <h1 className="title">Where are you starting?</h1>
        <p className="muted small" style={{ margin: '4px 0 0' }}>
          This only sets the first rung on each chain. After that, what you log decides everything.
        </p>

        <h2 className="section">Strict pull-ups in a row</h2>
        <Choice<PullLevel>
          value={c.pull}
          onChange={(pull) => setC({ ...c, pull })}
          options={[
            ['0', 'None yet', 'start with slow negatives'],
            ['1-4', '1 to 4', 'negatives, or band-assisted if you have bands'],
            ['5-11', '5 to 11', 'full pull-ups'],
            ['12+', '12 or more', 'archer pull-ups'],
          ]}
        />
        <button className={`option ${c.bands ? 'on' : ''}`} onClick={() => setC({ ...c, bands: !c.bands })}>
          <span className="grow">I have resistance bands</span>
          <span className={`toggle ${c.bands ? 'on' : ''}`}><i /></span>
        </button>

        <h2 className="section">Push-ups in a row, chest to the floor</h2>
        <Choice<PushLevel>
          value={c.push}
          onChange={(push) => setC({ ...c, push })}
          options={[
            ['0-4', '0 to 4', 'incline push-ups, bench dips'],
            ['5-14', '5 to 14', 'push-ups'],
            ['15-29', '15 to 29', 'diamond push-ups, elevated pike'],
            ['30+', '30 or more', 'pseudo planche push-ups'],
          ]}
        />

        <h2 className="section">Single-leg squats</h2>
        <Choice<SquatLevel>
          value={c.squat}
          onChange={(squat) => setC({ ...c, squat })}
          options={[
            ['squats', 'Two-leg squats are plenty', 'start with bodyweight squats'],
            ['split', 'Split squats are fine', 'Bulgarian split squats'],
            ['pistol', 'I can do a full pistol squat', 'pistols and skater squats'],
          ]}
        />

        <button className="btn btn--primary btn--block mt24" onClick={() => finish(true)}>
          Set my starting rungs
        </button>
        <button className="btn btn--ghost btn--block mt8" onClick={() => finish(false)}>
          Skip, use the defaults
        </button>
      </div>
    );
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="eyebrow">Liftdeck</div>
      <h1 className="title" style={{ fontSize: 34 }}>Get strong on a pull-up bar.</h1>
      <p className="muted" style={{ margin: '8px 0 0', lineHeight: 1.5 }}>
        Bodyweight only. A bar, a wall, a table, two chairs. Four sessions a week, about 45 minutes each.
      </p>

      <div className="card mt24">
        <div className="bold">How it works</div>
        <ul className="muted small" style={{ margin: '8px 0 0', paddingLeft: 18, lineHeight: 1.7 }}>
          <li>Every exercise sits on a <b>chain</b> of harder variations. Pull-up → archer → one-arm.</li>
          <li>Each set has an exact target, one rep above last time. Tap ✓ when you hit it.</li>
          <li>Hit the ceiling on every set and the next session serves the next rung.</li>
          <li>Three flat sessions and the app offers a deload or an easier rung for volume.</li>
          <li>Weeks are judged on totals. There is no "missed Wednesday".</li>
        </ul>
      </div>

      <button className="btn btn--primary btn--block mt24" onClick={() => setStep(1)}>
        Start
      </button>
      <div className="center faint tiny mt16">All data stays on this phone. No account, no cloud.</div>
    </div>
  );
}

function Choice<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: [T, string, string][] }) {
  return (
    <div role="radiogroup">
      {options.map(([v, label, hint]) => (
        <button key={v} role="radio" aria-checked={value === v} className={`option ${value === v ? 'on' : ''}`} onClick={() => onChange(v)}>
          <span className="grow">
            <span style={{ display: 'block', fontWeight: 600 }}>{label}</span>
            <span className="faint tiny">{hint}</span>
          </span>
          {value === v && <span className="accent bold">✓</span>}
        </button>
      ))}
    </div>
  );
}
