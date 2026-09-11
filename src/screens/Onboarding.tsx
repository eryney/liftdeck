import { useState } from 'react';
import { store, useAppState } from '../store/store';
import { BOXER_CUT_PLAN_ID } from '../data/seedPlan';
import { isFlexPlan } from '../lib/flex';

export function Onboarding({ onDone }: { onDone: (goToPlan: boolean) => void }) {
  const state = useAppState();
  const [preview, setPreview] = useState(false);
  const plan = state.plans.find((p) => p.id === BOXER_CUT_PLAN_ID) ?? state.plans[0];

  if (preview && plan && isFlexPlan(plan)) {
    return (
      <div className="screen" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div className="topline">WEEKLY TARGETS · NO FIXED WEEKDAYS</div>
        <h1 className="title">{plan.name} // FLEX</h1>
        <div className="panel mt16">
          {plan.weeklyGoals.map((g) => (
            <div key={g.id} className="spread mt8">
              <span className="small" style={{ fontWeight: 700, letterSpacing: '0.14em' }}>
                {g.kind === 'boxing' ? 'BOXING' : g.kind === 'rotation' ? 'STRENGTH' : g.optional ? 'OPTIONAL' : 'WORKOUT'}
              </span>
              <span className="small dim" style={{ textAlign: 'right' }}>
                {g.kind === 'workout' && g.optional ? (
                  <>{store.templateById(g.templateId)?.subtitle ?? ''} · 0–{g.max ?? g.target}</>
                ) : (
                  <>
                    minimum {g.minimum} · target {g.target}
                    {g.kind === 'rotation' && <div className="tiny faint">A ↔ B full body · rotation never resets</div>}
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="dim small mt16">
          Boxing is the sport. Two short full-body lifts keep strength and muscle while cutting; one is the floor on a bad week.
          Weeks are judged on totals, never on which day something happened. Rest days are just rest.
        </div>
        <button
          className="btn btn--primary mt16"
          onClick={() => {
            store.completeOnboarding(plan.id);
            onDone(false);
          }}
        >
          LET'S GO ▸
        </button>
        <button className="btn btn--ghost mt8" onClick={() => setPreview(false)}>
          BACK
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
        <div className="dim small">Boxing first. Lifting fits around it. Choose a plan:</div>
      </div>
      <button className="btn btn--primary mt16" onClick={() => setPreview(true)}>
        {plan ? `${plan.name} // FLEX` : 'BOXER CUT // FLEX'}
      </button>
      <button
        className="btn btn--ghost mt8"
        onClick={() => {
          store.completeOnboarding(plan?.id ?? null);
          onDone(true);
        }}
      >
        CREATE MY OWN (starts from the editor)
      </button>
      <div className="center faint tiny mt16">All data stays on this device. No account, no cloud.</div>
    </div>
  );
}
