import { useRef, useState } from 'react';
import { store, useAppState } from '../store/store';
import type { DayActivity, FixedWorkoutPlan, FlexWorkoutPlan, TemplateExercise, WeeklyGoal, WorkoutPlan, WorkoutTemplate } from '../types';
import { WEEKDAY_NAMES, todayISO } from '../lib/dates';
import { newId } from '../lib/ids';
import { Confirm, Sheet } from '../components/Sheet';
import { ExercisePicker } from '../components/ExercisePicker';
import { fmtRange, trimNum } from '../lib/format';
import { progressionById } from '../data/progressions';
import { isFlexPlan, nextRotationTemplateId, rotationGoal } from '../lib/flex';
import { buildPlanBundle, parsePlanBundle, resolveBundle } from '../lib/planBundle';
import type { ResolvedBundle } from '../lib/planBundle';
import { downloadFile } from '../lib/backup';

export function PlanScreen() {
  const state = useAppState();
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [deletingTpl, setDeletingTpl] = useState<string | null>(null);
  const [newPlanSheet, setNewPlanSheet] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPending, setImportPending] = useState<ResolvedBundle | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importedPlanId, setImportedPlanId] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const plan = store.activePlan();

  if (editingTemplate) {
    const tpl = state.templates.find((t) => t.id === editingTemplate);
    if (tpl) return <TemplateEditor template={tpl} onBack={() => setEditingTemplate(null)} />;
  }

  function exportPlan() {
    if (!plan) return;
    const bundle = buildPlanBundle(plan, store.state.templates, store.state.exercises);
    const slug = plan.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    downloadFile(`liftdeck-plan-${slug}-${todayISO()}.json`, JSON.stringify(bundle, null, 2));
    setNote('Plan exported. Templates and any custom exercises are included; history is not.');
  }

  async function onPlanFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const text = await file.text();
      const bundle = parsePlanBundle(text, store.state.exercises.map((x) => x.id));
      const resolved = resolveBundle(bundle, { plans: store.state.plans, templates: store.state.templates, exercises: store.state.exercises });
      setImportPending(resolved);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read file.');
    }
  }

  const importedPlan = importedPlanId ? state.plans.find((p) => p.id === importedPlanId) : null;

  return (
    <div className="screen">
      <div className="topline">CONFIGURATION</div>
      <h1 className="title">PLAN</h1>

      {plan ? (
        isFlexPlan(plan) ? (
          <FlexPlanPanel plan={plan} onRename={() => { setRenameVal(plan.name); setRenaming(true); }} onEditTemplate={setEditingTemplate} />
        ) : (
          <div className="panel mt16">
            <div className="spread">
              <div>
                <div style={{ fontWeight: 800, letterSpacing: '0.1em', fontSize: 17 }}>{plan.name}</div>
                <div className="tiny faint">FIXED WEEK</div>
              </div>
              <button className="btn btn--ghost btn--small" onClick={() => { setRenameVal(plan.name); setRenaming(true); }}>
                RENAME
              </button>
            </div>
            <div className="mt8">
              {plan.schedule.map((a, i) => (
                <div key={i} className="spread mt8 small">
                  <span className="faint" style={{ width: 46 }}>{WEEKDAY_NAMES[i].slice(0, 3)}</span>
                  <span style={{ flex: 1 }}>
                    {a.type === 'rest' ? (
                      <span className="faint">rest</span>
                    ) : a.type === 'boxing' ? (
                      'BOXING'
                    ) : (
                      store.templateById(a.templateId)?.name ?? '?'
                    )}
                    {'optional' in a && a.optional && <span className="purple tiny"> · OPTIONAL</span>}
                  </span>
                </div>
              ))}
            </div>
            <button className="btn btn--ghost mt16" style={{ width: '100%' }} onClick={() => setEditingSchedule(true)}>
              EDIT WEEKLY SCHEDULE
            </button>
          </div>
        )
      ) : (
        <div className="panel mt16 center dim small">No active plan.</div>
      )}

      <h2 className="section">WORKOUT TEMPLATES</h2>
      {state.templates.map((t) => (
        <div key={t.id} className="list-row">
          <button style={{ flex: 1, textAlign: 'left' }} onClick={() => setEditingTemplate(t.id)}>
            <div style={{ fontWeight: 700 }}>
              {t.name}
              {t.subtitle && <span className="faint"> // {t.subtitle}</span>}
            </div>
            <div className="tiny faint">{t.exercises.length} EXERCISES · TAP TO EDIT</div>
          </button>
          <button className="btn btn--ghost btn--small red" onClick={() => setDeletingTpl(t.id)}>
            DEL
          </button>
        </div>
      ))}
      <button
        className="btn btn--ghost mt8"
        style={{ width: '100%' }}
        onClick={() => {
          const tpl: WorkoutTemplate = { id: newId('tpl'), name: 'NEW WORKOUT', exercises: [] };
          store.saveTemplate(tpl);
          setEditingTemplate(tpl.id);
        }}
      >
        + NEW TEMPLATE
      </button>

      <h2 className="section">PLANS</h2>
      {state.plans.map((p) => (
        <div key={p.id} className="list-row">
          <span style={{ flex: 1 }}>
            {p.name}
            <span className="faint tiny"> · {isFlexPlan(p) ? 'FLEX' : 'FIXED'}</span>
          </span>
          {p.id === state.settings.activePlanId ? (
            <span className="cyan tiny">ACTIVE</span>
          ) : (
            <button className="btn btn--ghost btn--small" onClick={() => store.updateSettings({ activePlanId: p.id })}>
              ACTIVATE
            </button>
          )}
        </div>
      ))}
      <div className="row mt8" style={{ gap: 8 }}>
        <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setNewPlanSheet(true)}>
          + NEW PLAN
        </button>
        {plan && state.plans.length > 1 && (
          <button className="btn btn--ghost red" style={{ flex: 1 }} onClick={() => setDeletingPlan(true)}>
            DELETE ACTIVE PLAN
          </button>
        )}
      </div>

      <h2 className="section">PLAN FILES</h2>
      <div className="panel">
        <div className="tiny dim" style={{ lineHeight: 1.6 }}>
          Share or move a program without touching history. A plan file carries the plan, its templates and any custom exercises. Importing only adds; it never wipes anything.
        </div>
        <div className="row mt16" style={{ gap: 8 }}>
          <button className="btn" style={{ flex: 1 }} disabled={!plan} onClick={exportPlan}>
            EXPORT PLAN
          </button>
          <button className="btn" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
            IMPORT PLAN…
          </button>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onPlanFile} aria-label="plan file" />
      </div>

      {renaming && plan && (
        <Sheet onClose={() => setRenaming(false)}>
          <div className="tiny faint">RENAME PLAN</div>
          <input className="mt8" value={renameVal} onChange={(e) => setRenameVal(e.target.value)} autoFocus />
          <button
            className="btn btn--primary mt16"
            disabled={!renameVal.trim()}
            onClick={() => {
              store.savePlan({ ...plan, name: renameVal.trim().toUpperCase() });
              setRenaming(false);
            }}
          >
            SAVE
          </button>
        </Sheet>
      )}

      {editingSchedule && plan && !isFlexPlan(plan) && <ScheduleEditor plan={plan} onClose={() => setEditingSchedule(false)} />}

      {newPlanSheet && (
        <Sheet onClose={() => setNewPlanSheet(false)}>
          <div className="tiny faint">NEW PLAN</div>
          <button
            className="btn mt16"
            style={{ width: '100%' }}
            onClick={() => {
              const rot = state.templates.slice(0, 2).map((t) => t.id);
              const p: FlexWorkoutPlan = {
                id: newId('plan'),
                name: 'NEW FLEX PLAN',
                mode: 'flex',
                weeklyGoals: [
                  { id: newId('goal'), kind: 'boxing', minimum: 2, target: 4 },
                  ...(rot.length ? [{ id: newId('goal'), kind: 'rotation' as const, templateIds: rot, minimum: 1, target: 2, max: 2, minGapHours: 36 }] : []),
                ],
              };
              store.savePlan(p);
              store.updateSettings({ activePlanId: p.id });
              setNewPlanSheet(false);
            }}
          >
            FLEX · WEEKLY TARGETS
          </button>
          <div className="tiny faint mt8">Minimums and targets per week. No weekdays. A/B rotation continues across weeks.</div>
          <button
            className="btn mt16"
            style={{ width: '100%' }}
            onClick={() => {
              const p: FixedWorkoutPlan = {
                id: newId('plan'),
                name: 'NEW PLAN',
                mode: 'fixed',
                schedule: Array.from({ length: 7 }, () => ({ type: 'rest' as const })),
              };
              store.savePlan(p);
              store.updateSettings({ activePlanId: p.id });
              setNewPlanSheet(false);
              setEditingSchedule(true);
            }}
          >
            FIXED · WEEKDAY SCHEDULE
          </button>
          <div className="tiny faint mt8">Classic Monday–Sunday plan with missed-day tracking.</div>
        </Sheet>
      )}

      {deletingPlan && plan && (
        <Confirm
          title={`Delete plan "${plan.name}"?`}
          body="Templates and history are kept."
          confirmLabel="DELETE"
          danger
          onConfirm={() => {
            store.deletePlan(plan.id);
            setDeletingPlan(false);
          }}
          onCancel={() => setDeletingPlan(false)}
        />
      )}

      {deletingTpl && (
        <Confirm
          title={`Delete template "${state.templates.find((t) => t.id === deletingTpl)?.name}"?`}
          body="Past workouts are kept. Plans that use it drop the reference."
          confirmLabel="DELETE"
          danger
          onConfirm={() => {
            store.deleteTemplate(deletingTpl);
            setDeletingTpl(null);
          }}
          onCancel={() => setDeletingTpl(null)}
        />
      )}

      {importError && (
        <Sheet onClose={() => setImportError(null)}>
          <div className="red small">PLAN IMPORT FAILED</div>
          <div className="small mt8" style={{ lineHeight: 1.6 }}>{importError}</div>
          <button className="btn btn--ghost mt16" style={{ width: '100%' }} onClick={() => setImportError(null)}>
            OK
          </button>
        </Sheet>
      )}

      {importPending && (
        <Sheet onClose={() => setImportPending(null)}>
          <div className="tiny faint">IMPORT PLAN</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{importPending.plan.name}</div>
          <div className="small dim mt8">
            Adds {importPending.templates.length} template{importPending.templates.length === 1 ? '' : 's'}
            {importPending.exercises.length ? ` and ${importPending.exercises.length} exercise definition${importPending.exercises.length === 1 ? '' : 's'}` : ''}.
            Nothing existing is changed or removed.
          </div>
          {importPending.notes.map((n, i) => (
            <div key={i} className="tiny faint mt8">· {n}</div>
          ))}
          <div className="row mt16" style={{ gap: 10 }}>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setImportPending(null)}>
              CANCEL
            </button>
            <button
              className="btn btn--primary"
              style={{ flex: 2, minHeight: 52 }}
              onClick={async () => {
                const r = importPending;
                setImportPending(null);
                const id = await store.importPlanBundle(r);
                setImportedPlanId(id);
              }}
            >
              IMPORT
            </button>
          </div>
        </Sheet>
      )}

      {importedPlan && (
        <Sheet onClose={() => setImportedPlanId(null)}>
          <div className="green small">PLAN IMPORTED</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginTop: 6 }}>{importedPlan.name}</div>
          <div className="tiny faint mt8">Your history, body measurements and boxing log are exactly as they were.</div>
          <button
            className="btn btn--primary mt16"
            onClick={() => {
              store.updateSettings({ activePlanId: importedPlan.id });
              setImportedPlanId(null);
            }}
          >
            ACTIVATE PLAN
          </button>
          <button className="btn btn--ghost mt8" style={{ width: '100%' }} onClick={() => setImportedPlanId(null)}>
            KEEP CURRENT PLAN
          </button>
        </Sheet>
      )}

      {note && (
        <Sheet onClose={() => setNote(null)}>
          <div className="green small">{note}</div>
          <button className="btn btn--ghost mt16" style={{ width: '100%' }} onClick={() => setNote(null)}>
            OK
          </button>
        </Sheet>
      )}
    </div>
  );
}

// ── FLEX plan panel + editor ──────────────────────────────────────────────

function Stepper({ value, min, max, step = 1, onChange, label }: { value: number; min: number; max?: number; step?: number; onChange: (v: number) => void; label: string }) {
  return (
    <div className="stepper" aria-label={label}>
      <button style={{ width: 40, height: 40, fontSize: 18 }} onClick={() => onChange(Math.max(min, value - step))} aria-label={`${label} decrease`}>−</button>
      <span style={{ minWidth: 34, textAlign: 'center', fontWeight: 800, fontSize: 16 }}>{trimNum(value)}</span>
      <button style={{ width: 40, height: 40, fontSize: 18 }} onClick={() => onChange(max != null ? Math.min(max, value + step) : value + step)} aria-label={`${label} increase`}>+</button>
    </div>
  );
}

function FlexPlanPanel({ plan, onRename, onEditTemplate }: { plan: FlexWorkoutPlan; onRename: () => void; onEditTemplate: (id: string) => void }) {
  const state = useAppState();
  const [editing, setEditing] = useState(false);
  const rot = rotationGoal(plan);
  const next = rot ? nextRotationTemplateId(rot, state.sessions) : null;

  return (
    <div className="panel mt16">
      <div className="spread">
        <div>
          <div style={{ fontWeight: 800, letterSpacing: '0.1em', fontSize: 17 }}>{plan.name} // FLEX</div>
          <div className="tiny faint">WEEKLY TARGETS · NO WEEKDAYS</div>
        </div>
        <button className="btn btn--ghost btn--small" onClick={onRename}>RENAME</button>
      </div>

      {plan.weeklyGoals.map((g) => (
        <div key={g.id} className="mt16">
          <div className="spread">
            <span className="small" style={{ fontWeight: 700, letterSpacing: '0.16em' }}>
              {g.kind === 'boxing' ? 'BOXING' : g.kind === 'rotation' ? 'STRENGTH' : g.optional ? 'OPTIONAL' : 'WORKOUT'}
              {g.kind === 'workout' && (
                <span className="faint"> · {store.templateById(g.templateId)?.name ?? '?'}{store.templateById(g.templateId)?.subtitle ? ` // ${store.templateById(g.templateId)?.subtitle}` : ''}</span>
              )}
            </span>
            <span className="tiny dim">
              {g.kind === 'workout' && g.optional ? `${g.minimum}–${g.max ?? g.target}` : `minimum ${g.minimum} · target ${g.target}${g.max != null ? ` · max ${g.max}` : ''}`}
            </span>
          </div>
          {g.kind === 'rotation' && (
            <div className="tiny faint mt8">
              {g.templateIds.map((id, i) => (
                <span key={id}>
                  {i > 0 && <span> ↔ </span>}
                  <button className={id === next ? 'cyan' : 'dim'} style={{ textDecoration: 'underline dotted' }} onClick={() => onEditTemplate(id)}>
                    {String.fromCharCode(65 + i)} · {store.templateById(id)?.name ?? '?'}
                  </button>
                </span>
              ))}
              {next && <span> · next: {String.fromCharCode(65 + g.templateIds.indexOf(next))}</span>}
              {g.minGapHours != null && <span> · ≥{g.minGapHours}h apart</span>}
            </div>
          )}
        </div>
      ))}

      <button className="btn btn--ghost mt16" style={{ width: '100%' }} onClick={() => setEditing(true)}>
        EDIT WEEKLY TARGETS
      </button>
      {editing && <FlexGoalsEditor plan={plan} onClose={() => setEditing(false)} />}
    </div>
  );
}

function FlexGoalsEditor({ plan, onClose }: { plan: FlexWorkoutPlan; onClose: () => void }) {
  const state = useAppState();
  function setGoal(id: string, patch: Partial<WeeklyGoal>) {
    store.savePlan({
      ...plan,
      weeklyGoals: plan.weeklyGoals.map((g) => (g.id === id ? ({ ...g, ...patch } as WeeklyGoal) : g)),
    });
  }
  function removeGoal(id: string) {
    store.savePlan({ ...plan, weeklyGoals: plan.weeklyGoals.filter((g) => g.id !== id) });
  }
  const hasBoxing = plan.weeklyGoals.some((g) => g.kind === 'boxing');
  const hasRotation = plan.weeklyGoals.some((g) => g.kind === 'rotation');

  return (
    <Sheet onClose={onClose}>
      <div className="tiny faint">WEEKLY TARGETS · {plan.name}</div>
      <div style={{ maxHeight: '62dvh', overflowY: 'auto' }}>
        {plan.weeklyGoals.map((g) => (
          <div key={g.id} className="panel mt8">
            <div className="spread">
              <span className="small" style={{ fontWeight: 700, letterSpacing: '0.14em' }}>
                {g.kind === 'boxing' ? 'BOXING' : g.kind === 'rotation' ? 'STRENGTH · ROTATION' : g.optional ? 'OPTIONAL' : 'WORKOUT'}
              </span>
              <button className="btn btn--ghost btn--small red" onClick={() => removeGoal(g.id)} aria-label="remove goal">×</button>
            </div>
            <div className="spread mt8">
              <span className="small dim">MINIMUM / WEEK</span>
              <Stepper label={`${g.kind} minimum`} value={g.minimum} min={0} max={g.target} onChange={(v) => setGoal(g.id, { minimum: v })} />
            </div>
            <div className="spread mt8">
              <span className="small dim">TARGET / WEEK</span>
              <Stepper label={`${g.kind} target`} value={g.target} min={Math.max(g.minimum, 0)} max={14} onChange={(v) => setGoal(g.id, { target: v, ...(g.max != null && g.max < v ? { max: v } : {}) })} />
            </div>
            <div className="spread mt8">
              <span className="small dim">SOFT MAX {g.max == null ? '(off)' : ''}</span>
              <div className="row" style={{ gap: 6 }}>
                {g.max != null ? (
                  <>
                    <Stepper label={`${g.kind} max`} value={g.max} min={g.target} max={14} onChange={(v) => setGoal(g.id, { max: v })} />
                    <button className="chip" onClick={() => setGoal(g.id, { max: undefined })}>OFF</button>
                  </>
                ) : (
                  <button className="chip" onClick={() => setGoal(g.id, { max: g.target })}>SET</button>
                )}
              </div>
            </div>
            {g.kind === 'rotation' && (
              <>
                <div className="spread mt8">
                  <span className="small dim">MIN GAP (HOURS)</span>
                  <Stepper label="min gap hours" value={g.minGapHours ?? 36} min={0} max={96} step={6} onChange={(v) => setGoal(g.id, { minGapHours: v })} />
                </div>
                <div className="tiny faint mt8">ROTATION ORDER</div>
                {g.templateIds.map((tid, i) => (
                  <div key={`${tid}-${i}`} className="row mt8" style={{ gap: 8 }}>
                    <span className="faint tiny" style={{ width: 16 }}>{String.fromCharCode(65 + i)}</span>
                    <select
                      value={tid}
                      aria-label={`rotation slot ${String.fromCharCode(65 + i)}`}
                      onChange={(e) => setGoal(g.id, { templateIds: g.templateIds.map((x, j) => (j === i ? e.target.value : x)) })}
                    >
                      {state.templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}{t.subtitle ? ` // ${t.subtitle}` : ''}</option>
                      ))}
                    </select>
                    <button className="btn btn--ghost btn--small" disabled={g.templateIds.length <= 1} onClick={() => setGoal(g.id, { templateIds: g.templateIds.filter((_, j) => j !== i) })} aria-label="remove slot">×</button>
                  </div>
                ))}
                <button
                  className="btn btn--ghost btn--small mt8"
                  style={{ width: '100%' }}
                  disabled={state.templates.length === 0}
                  onClick={() => setGoal(g.id, { templateIds: [...g.templateIds, state.templates[0].id] })}
                >
                  + ADD SLOT
                </button>
              </>
            )}
            {g.kind === 'workout' && (
              <>
                <div className="row mt8" style={{ gap: 8 }}>
                  <select value={g.templateId} aria-label="goal template" onChange={(e) => setGoal(g.id, { templateId: e.target.value })}>
                    {state.templates.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}{t.subtitle ? ` // ${t.subtitle}` : ''}</option>
                    ))}
                  </select>
                  <button className={`chip ${g.optional ? 'on' : ''}`} onClick={() => setGoal(g.id, { optional: !g.optional || undefined })}>
                    OPT
                  </button>
                </div>
                <div className="tiny faint mt8">Optional goals never count toward FOUNDATION or TARGET.</div>
              </>
            )}
          </div>
        ))}
        <div className="row mt8" style={{ gap: 8, flexWrap: 'wrap' }}>
          {!hasBoxing && (
            <button className="btn btn--ghost btn--small" onClick={() => store.savePlan({ ...plan, weeklyGoals: [...plan.weeklyGoals, { id: newId('goal'), kind: 'boxing' as const, minimum: 2, target: 4 }] })}>
              + BOXING
            </button>
          )}
          {!hasRotation && state.templates.length > 0 && (
            <button
              className="btn btn--ghost btn--small"
              onClick={() =>
                store.savePlan({
                  ...plan,
                  weeklyGoals: [...plan.weeklyGoals, { id: newId('goal'), kind: 'rotation' as const, templateIds: state.templates.slice(0, 2).map((t) => t.id), minimum: 1, target: 2, max: 2, minGapHours: 36 }],
                })
              }
            >
              + ROTATION
            </button>
          )}
          {state.templates.length > 0 && (
            <button
              className="btn btn--ghost btn--small"
              onClick={() =>
                store.savePlan({
                  ...plan,
                  weeklyGoals: [...plan.weeklyGoals, { id: newId('goal'), kind: 'workout' as const, templateId: state.templates[state.templates.length - 1].id, minimum: 0, target: 1, max: 1, optional: true }],
                })
              }
            >
              + OPTIONAL WORKOUT
            </button>
          )}
        </div>
      </div>
      <button className="btn btn--primary mt16" onClick={onClose}>DONE</button>
    </Sheet>
  );
}

// ── LEGACY fixed schedule editor ──────────────────────────────────────────

function ScheduleEditor({ plan, onClose }: { plan: FixedWorkoutPlan; onClose: () => void }) {
  function setDay(i: number, a: DayActivity) {
    store.savePlan({ ...plan, schedule: plan.schedule.map((d, j) => (j === i ? a : d)) });
  }
  return (
    <Sheet onClose={onClose}>
      <div className="tiny faint">WEEKLY SCHEDULE · {plan.name}</div>
      <div style={{ maxHeight: '62dvh', overflowY: 'auto' }}>
        {plan.schedule.map((a, i) => {
          const value = a.type === 'rest' ? 'rest' : a.type === 'boxing' ? 'boxing' : a.templateId;
          const optional = 'optional' in a && !!a.optional;
          return (
            <div key={i} className="row mt8" style={{ gap: 8 }}>
              <span className="faint tiny" style={{ width: 40 }}>{WEEKDAY_NAMES[i].slice(0, 3)}</span>
              <select
                value={value}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === 'rest') setDay(i, { type: 'rest' });
                  else if (v === 'boxing') setDay(i, { type: 'boxing', optional: optional || undefined });
                  else setDay(i, { type: 'workout', templateId: v, optional: optional || undefined });
                }}
              >
                <option value="rest">Rest</option>
                <option value="boxing">Boxing</option>
                {store.state.templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                className={`chip ${optional ? 'on' : ''}`}
                style={{ opacity: a.type === 'rest' ? 0.3 : 1 }}
                disabled={a.type === 'rest'}
                onClick={() => {
                  if (a.type === 'boxing') setDay(i, { type: 'boxing', optional: !optional || undefined });
                  else if (a.type === 'workout') setDay(i, { type: 'workout', templateId: a.templateId, optional: !optional || undefined });
                }}
              >
                OPT
              </button>
            </div>
          );
        })}
      </div>
      <button className="btn btn--primary mt16" onClick={onClose}>
        DONE
      </button>
    </Sheet>
  );
}

// ── template editor ───────────────────────────────────────────────────────

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
      <div className="row" style={{ gap: 10 }}>
        <button className="btn btn--ghost btn--small" onClick={onBack}>
          ‹ PLAN
        </button>
        <div className="topline" style={{ margin: 0 }}>TEMPLATE EDITOR</div>
      </div>
      <input
        className="mt16"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && store.saveTemplate({ ...tpl, name: name.trim().toUpperCase() })}
        aria-label="template name"
        style={{ fontWeight: 800, letterSpacing: '0.08em', fontSize: 18 }}
      />
      <input
        className="mt8"
        value={subtitle}
        placeholder="subtitle (e.g. FULL BODY)"
        onChange={(e) => setSubtitle(e.target.value)}
        onBlur={() => store.saveTemplate({ ...tpl, subtitle: subtitle.trim() ? subtitle.trim().toUpperCase() : undefined })}
        aria-label="template subtitle"
      />
      <div className="tiny faint mt8">Editing a template changes future sessions only. Past workouts are snapshots and never change.</div>

      {tpl.exercises.map((te, i) => {
        const ex = store.exerciseById(te.exerciseId);
        return (
          <div key={te.id} className="list-row">
            <div className="row" style={{ flexDirection: 'column', gap: 2 }}>
              <button className="btn btn--ghost btn--small" style={{ minHeight: 30, padding: '0 10px' }} onClick={() => move(i, -1)} disabled={i === 0} aria-label="move up">
                ▲
              </button>
              <button className="btn btn--ghost btn--small" style={{ minHeight: 30, padding: '0 10px' }} onClick={() => move(i, 1)} disabled={i === tpl.exercises.length - 1} aria-label="move down">
                ▼
              </button>
            </div>
            <button style={{ flex: 1, textAlign: 'left' }} onClick={() => setConfiguring(te.id)}>
              <div>
                {ex?.name ?? te.exerciseId}
                {te.superset && i < tpl.exercises.length - 1 && <span className="cyan tiny"> ⇄</span>}
              </div>
              <div className="tiny faint">
                {te.sets} × {fmtRange(te.repMin, te.repMax, ex?.timed)}
                {ex?.perSide ? ' / side' : ''}
                {ex?.bodyweight ? '' : ` · +${trimNum(te.increment)}${ex?.perHand ? '/hand' : ''}`} · rest {te.restSec}s
                {te.targetRir != null ? ` · RIR ${te.targetRir}` : ''}
              </div>
              {ex?.progressionId && (
                <div className={`tiny ${te.lockVariation ? 'amber' : 'purple'}`}>
                  {progressionById(ex.progressionId)?.name ?? 'CHAIN'} · rung {(ex.level ?? 0) + 1}{te.lockVariation ? ' · LOCKED' : ' · follows the chain'}
                </div>
              )}
            </button>
            <button
              className="btn btn--ghost btn--small red"
              onClick={() => save(tpl.exercises.filter((x) => x.id !== te.id))}
              aria-label="remove"
            >
              ×
            </button>
          </div>
        );
      })}

      <button className="btn btn--ghost mt8" style={{ width: '100%' }} onClick={() => setAdding(true)}>
        + ADD EXERCISE
      </button>

      {adding && (
        <ExercisePicker
          onPick={(ex) => {
            const settings = store.state.settings;
            // sensible defaults: holds 20–40 s, bodyweight compounds 3×8–12 (pulls 5–8), isolation 2×10–15
            const isPull = ex.progressionId === 'pull' || ex.progressionId === 'chin';
            const slot: TemplateExercise = ex.timed
              ? { id: newId('te'), exerciseId: ex.id, sets: 3, repMin: 20, repMax: 40, restSec: 45, increment: 2.5, startWeight: 0, targetRir: 1 }
              : ex.bodyweight
                ? { id: newId('te'), exerciseId: ex.id, sets: ex.compound ? 3 : 2, repMin: isPull ? 5 : ex.compound ? 8 : 10, repMax: isPull ? 8 : ex.compound ? 12 : 15, restSec: ex.compound ? 75 : 45, increment: 5, startWeight: 0, targetRir: ex.compound ? 2 : 1 }
                : {
                    id: newId('te'),
                    exerciseId: ex.id,
                    sets: ex.compound ? 3 : 2,
                    repMin: ex.compound ? 6 : 10,
                    repMax: ex.compound ? 10 : 15,
                    restSec: ex.compound ? settings.compoundRestSec : settings.isolationRestSec,
                    increment: ex.equipment === 'dumbbell' && ex.compound && ['Chest', 'Shoulders', 'Back'].includes(ex.category) ? 2.5 : ex.equipment === 'cable' ? 2.5 : settings.defaultIncrement,
                    startWeight: 0,
                    targetRir: ex.compound ? 2 : 1,
                  };
            save([...tpl.exercises, slot]);
            setAdding(false);
          }}
          onClose={() => setAdding(false)}
        />
      )}

      {cfgTe && (
        <ExerciseConfigSheet
          te={cfgTe}
          onSwap={() => {
            setSwapping(cfgTe.id);
            setConfiguring(null);
          }}
          onSave={(next) => {
            save(tpl.exercises.map((x) => (x.id === next.id ? next : x)));
            setConfiguring(null);
          }}
          onClose={() => setConfiguring(null)}
        />
      )}

      {swapping && (
        <ExercisePicker
          title="SWAP EXERCISE"
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

function ExerciseConfigSheet({
  te,
  onSave,
  onSwap,
  onClose,
}: {
  te: TemplateExercise;
  onSave: (te: TemplateExercise) => void;
  onSwap: () => void;
  onClose: () => void;
}) {
  const [v, setV] = useState(te);
  const ex = store.exerciseById(te.exerciseId);
  const num = (label: string, key: 'sets' | 'repMin' | 'repMax' | 'restSec' | 'increment' | 'startWeight' | 'targetRir', step = 1, min = 0, hint?: string) => (
    <div className="spread mt8">
      <span className="small dim">
        {label}
        {hint && <div className="tiny faint">{hint}</div>}
      </span>
      <div className="stepper">
        <button
          style={{ width: 44, height: 44 }}
          onClick={() => setV({ ...v, [key]: Math.max(min, ((v[key] as number | undefined) ?? 0) - step) })}
          aria-label={`${label} decrease`}
        >
          −
        </button>
        <span style={{ minWidth: 56, textAlign: 'center', fontWeight: 800, fontSize: 17 }}>
          {v[key] == null ? '—' : trimNum(v[key] as number)}
        </span>
        <button style={{ width: 44, height: 44 }} onClick={() => setV({ ...v, [key]: ((v[key] as number | undefined) ?? 0) + step })} aria-label={`${label} increase`}>
          +
        </button>
      </div>
    </div>
  );
  const incHint = ex?.bodyweight ? 'backpack step once the chain is topped out' : ex?.perHand ? 'PER HAND (each dumbbell)' : ex?.equipment === 'cable' ? 'smallest practical stack step' : undefined;
  const chain = ex?.progressionId ? progressionById(ex.progressionId) : undefined;
  const toggle = (label: string, key: 'superset' | 'lockVariation', hint: string) => (
    <div className="spread mt8">
      <span className="small dim">
        {label}
        <div className="tiny faint">{hint}</div>
      </span>
      <button className={`chip ${v[key] ? 'on' : ''}`} onClick={() => setV({ ...v, [key]: v[key] ? undefined : true })} aria-pressed={!!v[key]}>
        {v[key] ? 'ON' : 'OFF'}
      </button>
    </div>
  );
  return (
    <Sheet onClose={onClose}>
      <div className="tiny faint">CONFIGURE</div>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{ex?.name}</div>
      {chain && <div className="tiny purple">{chain.name} · rung {(ex?.level ?? 0) + 1} · {chain.muscles}</div>}
      <div style={{ maxHeight: '58dvh', overflowY: 'auto' }}>
        {num('SETS', 'sets', 1, 1)}
        {num(ex?.timed ? 'MIN SECONDS' : 'REP MIN', 'repMin', ex?.timed ? 5 : 1, 1)}
        {num(ex?.timed ? 'MAX SECONDS' : 'REP MAX', 'repMax', ex?.timed ? 5 : 1, 1, chain ? 'every set here → next rung' : undefined)}
        {num('REST (SEC)', 'restSec', 15, 15)}
        {num(ex?.bodyweight ? 'ADDED-LOAD STEP (LB)' : 'INCREMENT (LB)', 'increment', 1.25, 1.25, incHint)}
        {!ex?.bodyweight && num(ex?.perHand ? 'START WEIGHT / HAND' : 'START WEIGHT', 'startWeight', 2.5, 0)}
        {num('TARGET RIR', 'targetRir', 1, 0, 'reps in reserve · telemetry only')}
        {toggle('SUPERSET WITH NEXT', 'superset', 'alternate sets with the slot below (antagonist pair)')}
        {chain && toggle('LOCK VARIATION', 'lockVariation', 'stay on this rung · never follow the chain')}
      </div>
      <div className="row mt16" style={{ gap: 10 }}>
        <button className="btn btn--ghost" style={{ flex: 1 }} onClick={onSwap}>
          SWAP EXERCISE
        </button>
        <button
          className="btn btn--primary"
          style={{ flex: 1, minHeight: 48 }}
          onClick={() => onSave({ ...v, repMax: Math.max(v.repMax, v.repMin) })}
        >
          SAVE
        </button>
      </div>
    </Sheet>
  );
}

export type { WorkoutPlan };
