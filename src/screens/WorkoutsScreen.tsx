import { useState } from 'react';
import { store, useAppState } from '../store/store';
import { rotationGoal, workoutGoals, workoutTemplateIds } from '../lib/flex';
import { fmtRange } from '../lib/format';
import { fmtTargets } from '../lib/prescribe';
import { ExerciseGuide } from '../components/ExerciseGuide';
import { CardioLog } from '../components/CardioLog';

export function WorkoutsScreen({ onOpenWorkout }: { onOpenWorkout: (id: string) => void }) {
  useAppState();
  const plan = store.activePlan();
  const rotation = plan ? rotationGoal(plan) : null;
  const ids = [...new Set([...(rotation?.templateIds ?? []), ...(plan ? workoutGoals(plan).flatMap(workoutTemplateIds) : [])])];
  const templates = ids.map((id) => store.templateById(id)).filter((t) => !!t);
  const [selected, setSelected] = useState<string | null>(null);
  const [cardio, setCardio] = useState(false);
  const template = templates.find((t) => t?.id === selected) ?? templates[0];
  const preview = template ? store.previewWorkout(template.id) : [];
  const active = store.activeSession();
  const paired = [...new Set(preview.map((e) => e.pairGroup).filter(Boolean))];
  return <div className="screen">
    <div className="eyebrow">Your program</div>
    <h1 className="title">Workouts</h1>
    <p className="muted small">Browse the complete sessions and the variations your next workout will use.</p>
    {rotation?.restDays && <p className="faint tiny">Alternate A / B / A, then B / A / B. Leave a recovery day between strength sessions.</p>}
    <div className="workout-tabs" role="group" aria-label="Choose workout">
      {templates.map((t) => t && <button key={t.id} className={`btn btn--small ${t.id === template?.id ? 'btn--primary' : 'btn--ghost'}`} aria-pressed={t.id === template?.id} onClick={() => setSelected(t.id)}>{t.name}</button>)}
    </div>
    {template ? <section key={template.id} aria-label={`${template.name} complete workout`}>
      <h2 className="section">{template.name}</h2>
      <p className="muted small">{template.subtitle}</p>
      {template.activityType === 'cardio' ? <>
        <p className="small">Choose your own cardio session. Log the activity and completed minutes toward your optional weekly sessions.</p>
        <button className="btn btn--primary btn--block" onClick={() => setCardio(true)}>Log cardio</button>
      </> : <>
        {template.warmup?.length && <details className="warmup"><summary className="bold small">Warm-up</summary><ul>{template.warmup.map((w) => <li key={w}>{w}</li>)}</ul></details>}
        <div className="faint tiny mt12">{preview.length} exercises · {preview.reduce((n,e) => n + e.targetSets,0)} work sets. Alternate sets within each pair or group.</div>
        {preview.map((e,i) => <details className="workout-outline card mt12" key={e.slotId ?? `${e.exerciseId}-${i}`}>
          <summary>
            <span className="workout-outline__number">{i + 1}</span>
            <span className="grow"><span className="bold">{e.name}</span>
              <span className="faint tiny" style={{ display: 'block' }}>{e.targetSets} × {fmtRange(e.repMin,e.repMax,e.timed)}{e.perSide ? ' per side' : ''} · rest {e.restSec}s{e.pairGroup ? ` · group ${paired.indexOf(e.pairGroup) + 1}` : ''}</span>
            </span><span className="link tiny">Guide</span>
          </summary>
          <div className="muted small mt12">Next targets: {fmtTargets(e.targetReps,e.timed)}</div>
          <ExerciseGuide exerciseId={e.exerciseId} showCue />
          {e.gear && <p className="faint tiny">Needs: {e.gear}</p>}
          <p className="faint tiny">{e.progressionId ? `Reach ${e.repMax}${e.timed ? ' seconds' : ' reps'} on all ${e.targetSets} sets to advance when another variation is available.` : `Targets stay within ${fmtRange(e.repMin,e.repMax,e.timed)}. At the ceiling, ${e.bandResistance ? 'choose a stronger band when ready' : e.repsOnly ? 'repeat with controlled form' : 'increase difficulty or load when ready'}.`}</p>
        </details>)}
        <button className="btn btn--primary btn--block mt16" onClick={() => onOpenWorkout(active?.id ?? store.startWorkout(template.id))}>{active ? `Resume ${active.name}` : `Start ${template.name}`}</button>
      </>}
    </section> : <p className="muted">Choose a program in Settings to see its workouts.</p>}
    {cardio && <CardioLog onClose={() => setCardio(false)} />}
  </div>;
}
