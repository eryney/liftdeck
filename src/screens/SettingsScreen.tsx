import { useRef, useState } from 'react';
import { store, useAppState } from '../store/store';
import { buildBackup, downloadFile, measurementsToCSV, parseBackup, sessionsToCSV } from '../lib/backup';
import { Confirm, Sheet } from '../components/Sheet';
import { ExercisePicker } from '../components/ExercisePicker';
import { todayISO } from '../lib/dates';
import { fmtRange } from '../lib/format';
import { newId } from '../lib/ids';
import { progressionById } from '../data/progressions';
import { rotationGoal, workoutGoals } from '../lib/flex';
import type { TemplateExercise, WeeklyGoal, WorkoutPlan, WorkoutTemplate } from '../types';

export function SettingsScreen() {
  const state = useAppState();
  const s = state.settings;
  const plan = store.activePlan();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPending, setImportPending] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [resetStage, setResetStage] = useState(0);
  const [resetText, setResetText] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingGoals, setEditingGoals] = useState(false);
  const [restoring, setRestoring] = useState(false);

  if (editingTemplate) {
    const tpl = state.templates.find((t) => t.id === editingTemplate);
    if (tpl) return <TemplateEditor template={tpl} onBack={() => setEditingTemplate(null)} />;
  }

  function toggle(key: 'soundOn' | 'vibrateOn') {
    store.updateSettings({ [key]: !s[key] });
  }

  function exportJSON() {
    const backup = buildBackup(store.exportShape());
    downloadFile(`liftdeck-backup-${todayISO()}.json`, JSON.stringify(backup, null, 2));
    setNote('Backup exported.');
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      parseBackup(text); // validate
      setImportPending(text);
      setImportError(null);
    } catch (err) {
      setImportError((err as Error).message);
    }
  }

  async function confirmImport() {
    if (!importPending) return;
    const backup = parseBackup(importPending);
    await store.importBackup(backup);
    setImportPending(null);
    setNote(`Restored ${backup.sessions.length} sessions.`);
  }

  const rot = plan ? rotationGoal(plan) : null;
  const opt = plan ? workoutGoals(plan).find((g) => g.optional) : null;

  return (
    <div className="screen">
      <div className="eyebrow">Settings</div>
      <h1 className="title">Program & data</h1>

      {plan && (
        <>
          <h2 className="section">Program</h2>
          <div className="card">
            <div className="spread">
              <div>
                <div className="bold">{plan.name}</div>
                <div className="faint tiny">
                  {rot ? `${rot.minimum}–${rot.max ?? rot.target} sessions a week · target ${rot.target} · ${rot.minGapHours ?? 20} h apart` : 'no rotation'}
                  {opt ? ` · ${store.templateById(opt.templateId)?.name ?? 'optional'} 0–${opt.max ?? opt.target}` : ''}
                </div>
              </div>
              <button className="btn btn--small" onClick={() => setEditingGoals(true)}>Weekly targets</button>
            </div>
            <div className="hr" />
            <div className="eyebrow">Sessions in rotation</div>
            {(rot?.templateIds ?? []).map((id, i) => {
              const t = store.templateById(id);
              if (!t) return null;
              return (
                <button key={id} className="list-row" onClick={() => setEditingTemplate(id)}>
                  <span className="faint small" style={{ width: 20 }}>{i + 1}</span>
                  <span className="grow">
                    <span className="bold">{t.name}</span>
                    <span className="faint tiny" style={{ display: 'block' }}>{t.subtitle} · {t.exercises.length} exercises</span>
                  </span>
                  <span className="link">Edit</span>
                </button>
              );
            })}
            {opt && store.templateById(opt.templateId) && (
              <>
                <div className="eyebrow mt12">Optional</div>
                <button className="list-row" onClick={() => setEditingTemplate(opt.templateId)}>
                  <span className="grow">
                    <span className="bold">{store.templateById(opt.templateId)?.name}</span>
                    <span className="faint tiny" style={{ display: 'block' }}>{store.templateById(opt.templateId)?.subtitle}</span>
                  </span>
                  <span className="link">Edit</span>
                </button>
              </>
            )}
            <button className="btn btn--ghost btn--small btn--block mt12" onClick={() => setRestoring(true)}>Restore the default program</button>
          </div>
        </>
      )}

      <h2 className="section">Session</h2>
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        <button className="list-row" onClick={() => toggle('soundOn')}>
          <span className="grow">Timer sound</span>
          <span className={`toggle ${s.soundOn ? 'on' : ''}`} aria-hidden><i /></span>
        </button>
        <button className="list-row" onClick={() => toggle('vibrateOn')}>
          <span className="grow">Vibrate</span>
          <span className={`toggle ${s.vibrateOn ? 'on' : ''}`} aria-hidden><i /></span>
        </button>
        <button className="list-row" onClick={() => store.updateSettings({ units: s.units === 'lb' ? 'kg' : 'lb' })}>
          <span className="grow">Added-load unit</span>
          <span className="pill">{s.units}</span>
        </button>
      </div>

      <h2 className="section">Data</h2>
      <div className="card">
        <p className="faint tiny" style={{ margin: 0 }}>Everything lives on this phone. iOS can clear storage for sites you stop visiting, so export a backup now and then.</p>
        <button className="btn btn--block mt12" onClick={exportJSON}>Export backup</button>
        <button className="btn btn--ghost btn--block mt8" onClick={() => fileRef.current?.click()}>Import backup…</button>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onFile} aria-label="backup file" />
        <div className="row mt8">
          <button className="btn btn--ghost btn--small grow" onClick={() => { downloadFile(`liftdeck-sessions-${todayISO()}.csv`, sessionsToCSV(state.sessions), 'text/csv'); setNote('Sessions CSV exported.'); }}>Sessions CSV</button>
          <button className="btn btn--ghost btn--small grow" onClick={() => { downloadFile(`liftdeck-body-${todayISO()}.csv`, measurementsToCSV(state.measurements), 'text/csv'); setNote('Body CSV exported.'); }}>Body CSV</button>
        </div>
        {importError && <div className="red small mt8">{importError}</div>}
        {note && <div className="green small mt8">{note}</div>}
      </div>

      <h2 className="section">Danger zone</h2>
      <div className="card card--soft">
        <button className="btn btn--danger btn--block" onClick={() => setResetStage(1)}>Reset all data</button>
      </div>

      <div className="center faint tiny mt24">Liftdeck · schema v{s.schemaVersion}</div>

      {importPending && (
        <Confirm
          title="Replace everything with this backup?"
          body="All current data on this device is replaced by the backup. Export first if you want to keep it."
          confirmLabel="Replace"
          danger
          onConfirm={confirmImport}
          onCancel={() => setImportPending(null)}
        />
      )}

      {restoring && (
        <Confirm
          title="Restore the default program?"
          body="Sessions and weekly targets go back to how they shipped. Your history and chain positions are untouched; starting rungs come from your history, not the template."
          confirmLabel="Restore"
          onConfirm={() => { store.restoreDefaultProgram(); setRestoring(false); setNote('Default program restored.'); }}
          onCancel={() => setRestoring(false)}
        />
      )}

      {resetStage === 1 && (
        <Sheet onClose={() => setResetStage(0)} title="Reset all data?">
          <p className="muted small" style={{ margin: '8px 0 0' }}>Every session, measurement and setting on this device is deleted. Type RESET to confirm.</p>
          <input className="mt12" value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" aria-label="type RESET to confirm" autoFocus />
          <div className="row mt16">
            <button className="btn btn--ghost grow" onClick={() => { setResetStage(0); setResetText(''); }}>Cancel</button>
            <button className="btn btn--danger grow" disabled={resetText !== 'RESET'} onClick={async () => { await store.resetAll(); setResetStage(0); setResetText(''); }}>Delete everything</button>
          </div>
        </Sheet>
      )}

      {editingGoals && plan && <GoalsEditor plan={plan} onClose={() => setEditingGoals(false)} />}
    </div>
  );
}

// ── weekly targets ─────────────────────────────────────────────────────────

function Stepper({ value, min, max, step = 1, onChange, label }: { value: number; min: number; max?: number; step?: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button onClick={() => onChange(Math.max(min, value - step))} aria-label={`decrease ${label}`}>−</button>
      <span className="val">{value}</span>
      <button onClick={() => onChange(max != null ? Math.min(max, value + step) : value + step)} aria-label={`increase ${label}`}>+</button>
    </div>
  );
}

function GoalsEditor({ plan, onClose }: { plan: WorkoutPlan; onClose: () => void }) {
  const state = useAppState();
  const rot = rotationGoal(plan);
  const opt = workoutGoals(plan).find((g) => g.optional) ?? null;
  const [name, setName] = useState(plan.name);

  function saveGoal(next: WeeklyGoal) {
    store.savePlan({ ...plan, weeklyGoals: plan.weeklyGoals.map((g) => (g.id === next.id ? next : g)) });
  }

  function toggleOptional() {
    if (opt) {
      store.savePlan({ ...plan, weeklyGoals: plan.weeklyGoals.filter((g) => g.id !== opt.id) });
    } else {
      const flow = state.templates.find((t) => !rot?.templateIds.includes(t.id));
      if (!flow) return;
      store.savePlan({ ...plan, weeklyGoals: [...plan.weeklyGoals, { id: newId('goal'), kind: 'workout', templateId: flow.id, minimum: 0, target: 1, max: 2, optional: true }] });
    }
  }

  return (
    <Sheet onClose={onClose} title="Weekly targets">
      <input className="mt12" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && store.savePlan({ ...plan, name: name.trim() })} aria-label="program name" />
      {rot && (
        <>
          <div className="spread mt16">
            <div><div className="bold small">Minimum sessions</div><div className="faint tiny">the week counts as kept</div></div>
            <Stepper label="minimum" value={rot.minimum} min={1} max={rot.target} onChange={(v) => saveGoal({ ...rot, minimum: v })} />
          </div>
          <div className="spread mt12">
            <div><div className="bold small">Target sessions</div><div className="faint tiny">what the plan aims for</div></div>
            <Stepper label="target" value={rot.target} min={rot.minimum} max={7} onChange={(v) => saveGoal({ ...rot, target: v, max: rot.max != null ? Math.max(rot.max, v) : rot.max })} />
          </div>
          <div className="spread mt12">
            <div><div className="bold small">Soft max</div><div className="faint tiny">no strength session is offered past this</div></div>
            <Stepper label="soft max" value={rot.max ?? rot.target} min={rot.target} max={7} onChange={(v) => saveGoal({ ...rot, max: v })} />
          </div>
          <div className="spread mt12">
            <div><div className="bold small">Hours between sessions</div><div className="faint tiny">upper and lower alternate, so 20 h allows back-to-back days</div></div>
            <Stepper label="gap hours" value={rot.minGapHours ?? 20} min={0} max={72} step={4} onChange={(v) => saveGoal({ ...rot, minGapHours: v })} />
          </div>
        </>
      )}
      <div className="hr" />
      <button className="list-row" onClick={toggleOptional}>
        <span className="grow">
          <span className="bold small">Optional Flow session</span>
          <span className="faint tiny" style={{ display: 'block' }}>offered on rest days · never affects the week's verdict</span>
        </span>
        <span className={`toggle ${opt ? 'on' : ''}`} aria-hidden><i /></span>
      </button>
      {opt && (
        <div className="spread mt8">
          <div className="small">Max per week</div>
          <Stepper label="optional max" value={opt.max ?? 2} min={1} max={4} onChange={(v) => saveGoal({ ...opt, max: v, target: Math.min(opt.target, v) })} />
        </div>
      )}
      <button className="btn btn--block mt16" onClick={onClose}>Done</button>
    </Sheet>
  );
}

// ── template editor ────────────────────────────────────────────────────────

function TemplateEditor({ template, onBack }: { template: WorkoutTemplate; onBack: () => void }) {
  const state = useAppState();
  const tpl = state.templates.find((t) => t.id === template.id) ?? template;
  const [adding, setAdding] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [name, setName] = useState(tpl.name);
  const [subtitle, setSubtitle] = useState(tpl.subtitle ?? '');

  function save(exercises: TemplateExercise[]) {
    store.saveTemplate({ ...tpl, exercises });
  }

  function move(i: number, dir: -1 | 1) {
    const arr = [...tpl.exercises];
    const j = i + dir;
    if (j < 0 || j >= arr.length) return;
    [arr[i], arr[j]] = [arr[j], arr[i]];
    save(arr);
  }

  const cfgTe = configuring ? tpl.exercises.find((te) => te.id === configuring) : null;

  return (
    <div className="screen">
      <button className="link" onClick={onBack}>‹ Settings</button>
      <div className="eyebrow mt12">Edit session</div>
      <input className="mt8" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && store.saveTemplate({ ...tpl, name: name.trim() })} aria-label="session name" style={{ fontWeight: 800, fontSize: 20 }} />
      <input className="mt8" value={subtitle} placeholder="Subtitle" onChange={(e) => setSubtitle(e.target.value)} onBlur={() => store.saveTemplate({ ...tpl, subtitle: subtitle.trim() || undefined })} aria-label="session subtitle" />
      <div className="faint tiny mt8">Changes apply to future sessions. Past workouts never change. The exercise named here is only the starting rung; the chain takes over from your history.</div>

      <div className="card mt16" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {tpl.exercises.map((te, i) => {
          const ex = store.exerciseById(te.exerciseId);
          const paired = te.superset && i < tpl.exercises.length - 1;
          return (
            <div key={te.id} className="list-row" style={{ alignItems: 'stretch' }}>
              <div className="col" style={{ gap: 2 }}>
                <button className="btn btn--ghost btn--tiny" onClick={() => move(i, -1)} disabled={i === 0} aria-label="move up">▲</button>
                <button className="btn btn--ghost btn--tiny" onClick={() => move(i, 1)} disabled={i === tpl.exercises.length - 1} aria-label="move down">▼</button>
              </div>
              <button className="grow" onClick={() => setConfiguring(te.id)}>
                <div className="bold small">
                  {ex?.name ?? te.exerciseId}
                  {paired && <span className="accent"> ⇄</span>}
                </div>
                <div className="faint tiny">
                  {te.sets} × {fmtRange(te.repMin, te.repMax, ex?.timed)}
                  {ex?.perSide ? ' per side' : ''} · rest {te.restSec}s
                  {ex?.progressionId ? ` · ${progressionById(ex.progressionId)?.name ?? 'chain'} chain${te.lockVariation ? ' · locked' : ''}` : ''}
                </div>
              </button>
              <button className="btn btn--ghost btn--tiny red" onClick={() => save(tpl.exercises.filter((x) => x.id !== te.id))} aria-label="remove">×</button>
            </div>
          );
        })}
      </div>

      <button className="btn btn--ghost btn--block mt12" onClick={() => setAdding(true)}>+ Add exercise</button>

      {adding && (
        <ExercisePicker
          onPick={(ex) => {
            const isPull = ex.progressionId === 'pull' || ex.progressionId === 'chin';
            const isHold = !!ex.timed;
            const slot: TemplateExercise = {
              id: newId('te'),
              exerciseId: ex.id,
              sets: 3,
              repMin: isHold ? 15 : isPull ? 5 : ex.progressionId ? 6 : 10,
              repMax: isHold ? 30 : isPull ? 8 : ex.progressionId ? 10 : 15,
              restSec: isHold ? 45 : ex.progressionId ? 75 : 45,
              increment: 5,
              startWeight: 0,
            };
            save([...tpl.exercises, slot]);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {cfgTe && (
        <SlotSheet
          te={cfgTe}
          isLast={tpl.exercises[tpl.exercises.length - 1]?.id === cfgTe.id}
          onSwap={() => { setSwapping(cfgTe.id); setConfiguring(null); }}
          onSave={(next) => save(tpl.exercises.map((x) => (x.id === next.id ? next : x)))}
          onClose={() => setConfiguring(null)}
        />
      )}

      {swapping && (
        <ExercisePicker
          title="Swap exercise"
          forExerciseId={tpl.exercises.find((x) => x.id === swapping)?.exerciseId}
          onPick={(ex) => {
            save(tpl.exercises.map((x) => (x.id === swapping ? { ...x, exerciseId: ex.id } : x)));
            setSwapping(null);
          }}
          onClose={() => setSwapping(null)}
        />
      )}
    </div>
  );
}

function SlotSheet({ te, isLast, onSave, onSwap, onClose }: { te: TemplateExercise; isLast: boolean; onSave: (te: TemplateExercise) => void; onSwap: () => void; onClose: () => void }) {
  const ex = store.exerciseById(te.exerciseId);
  const timed = !!ex?.timed;
  const step = timed ? 5 : 1;
  return (
    <Sheet onClose={onClose} title={ex?.name ?? te.exerciseId}>
      {ex?.progressionId && <div className="faint tiny mt4">{progressionById(ex.progressionId)?.name} chain · this is the starting rung only</div>}
      <div className="spread mt16">
        <div className="small bold">Sets</div>
        <Stepper label="sets" value={te.sets} min={1} max={8} onChange={(v) => onSave({ ...te, sets: v })} />
      </div>
      <div className="spread mt12">
        <div><div className="small bold">Floor</div><div className="faint tiny">{timed ? 'seconds' : 'reps'} a new rung starts at</div></div>
        <Stepper label="floor" value={te.repMin} min={step} max={te.repMax} step={step} onChange={(v) => onSave({ ...te, repMin: v })} />
      </div>
      <div className="spread mt12">
        <div><div className="small bold">Ceiling</div><div className="faint tiny">every set here → next rung</div></div>
        <Stepper label="ceiling" value={te.repMax} min={te.repMin} max={timed ? 180 : 50} step={step} onChange={(v) => onSave({ ...te, repMax: v })} />
      </div>
      <div className="spread mt12">
        <div className="small bold">Rest (s)</div>
        <Stepper label="rest" value={te.restSec} min={15} max={300} step={15} onChange={(v) => onSave({ ...te, restSec: v })} />
      </div>
      {!isLast && (
        <button className="list-row mt8" onClick={() => onSave({ ...te, superset: !te.superset })}>
          <span className="grow"><span className="small bold">Pair with the next exercise</span><span className="faint tiny" style={{ display: 'block' }}>alternate sets, rest between</span></span>
          <span className={`toggle ${te.superset ? 'on' : ''}`} aria-hidden><i /></span>
        </button>
      )}
      {ex?.progressionId && (
        <button className="list-row" onClick={() => onSave({ ...te, lockVariation: !te.lockVariation })}>
          <span className="grow"><span className="small bold">Lock this variation</span><span className="faint tiny" style={{ display: 'block' }}>never move along the chain</span></span>
          <span className={`toggle ${te.lockVariation ? 'on' : ''}`} aria-hidden><i /></span>
        </button>
      )}
      <div className="row mt16">
        <button className="btn btn--ghost grow" onClick={onSwap}>Swap exercise</button>
        <button className="btn grow" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}
