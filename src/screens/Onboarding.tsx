import { useState } from 'react';
import { store, useAppState } from '../store/store';
import { PLAN_ID } from '../data/seedPlan';
import { WEEKDAY_NAMES } from '../lib/dates';

export function Onboarding({ onDone }: { onDone: (goToPlan: boolean) => void }) {
  const state = useAppState();
  const [preview, setPreview] = useState(false);
  const plan = state.plans.find((p) => p.id === PLAN_ID);

  if (preview && plan) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="topline">WEEKLY SCHEDULE</div>
        <h1 className="title">{plan.name}</h1>
        <div className="panel mt16">
          {plan.schedule.map((a, i) => (
            <div key={i} className="spread mt8">
              <span className="faint small" style={{ width: 100 }}>{WEEKDAY_NAMES[i]}</span>
              <span className="small" style={{ flex: 1, textAlign: 'right' }}>
                {a.type === 'rest' ? (
                  <span className="faint">—</span>
                ) : a.type === 'boxing' ? (
                  'BOXING'
                ) : (
                  store.templateById(a.templateId)?.name ?? '?'
                )}
                {'optional' in a && a.optional && <span className="purple tiny"> OPT</span>}
              </span>
            </div>
          ))}
        </div>
        <div className="dim small mt16">
          Strength days auto-track weights and progression. Boxing days are one tap. Friday is optional —
          skipping it never counts against you.
        </div>
        <button
          className="btn btn--primary mt16"
          onClick={() => {
            store.completeOnboarding(PLAN_ID);
            onDone(false);
          }}
        >
          LET'S GO ▸
        </button>
      </div>
    );
  }

  return (
    <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
      <div className="center">
        <div className="topline">SYSTEM ONLINE</div>
        <h1 className="title" style={{ fontSize: 34 }}>
          LIFT<span className="cyan">DECK</span>
        </h1>
        <div className="dim small">Your training, on rails. Choose a plan:</div>
      </div>
      <button className="btn btn--primary mt16" onClick={() => setPreview(true)}>
        {plan?.name ?? 'PROGRAM 01'}
      </button>
      <button
        className="btn btn--ghost mt8"
        onClick={() => {
          store.completeOnboarding(PLAN_ID);
          onDone(true);
        }}
      >
        CREATE MY OWN (starts from the editor)
      </button>
      <div className="center faint tiny mt16">All data stays on this device. No account, no cloud.</div>
    </div>
  );
}
