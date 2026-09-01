import { useState } from 'react';
import { store, useAppState } from '../store/store';
import type { DayActivity, TemplateExercise, WorkoutPlan, WorkoutTemplate } from '../types';
import { WEEKDAY_NAMES } from '../lib/dates';
import { newId } from '../lib/ids';
import { Confirm, Sheet } from '../components/Sheet';
import { ExercisePicker } from '../components/ExercisePicker';
import { trimNum } from '../lib/format';

export function PlanScreen() {
  const state = useAppState();
  const [editingTemplate, setEditingTemplate] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState('');
  const [deletingPlan, setDeletingPlan] = useState(false);
  const [deletingTpl, setDeletingTpl] = useState<string | null>(null);

  const plan = store.activePlan();

  if (editingTemplate) {
    const tpl = state.templates.find((t) => t.id === editingTemplate);
    if (tpl) return <TemplateEditor template={tpl} onBack={() => setEditingTemplate(null)} />;
  }

  return (
    <div className="screen">
      <div className="topline">CONFIGURATION</div>
      <h1 className="title">PLAN</h1>

      {plan ? (
        <>
          <div className="panel mt16">
            <div className="spread">
              <div style={{ fontWeight: 800, letterSpacing: '0.1em', fontSize: 17 }}>{plan.name}</div>
              <button
                className="btn btn--ghost btn--small"
                onClick={() => {
                  setRenameVal(plan.name);
                  setRenaming(true);
                }}
              >
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
        </>
      ) : (
        <div className="panel mt16 center dim small">No active plan.</div>
      )}

      <h2 className="section">WORKOUT TEMPLATES</h2>
      {state.templates.map((t) => (
        <div key={t.id} className="list-row">
          <button style={{ flex: 1, textAlign: 'left' }} onClick={() => setEditingTemplate(t.id)}>
            <div style={{ fontWeight: 700 }}>{t.name}</div>
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
          <span style={{ flex: 1 }}>{p.name}</span>
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
        <button
          className="btn btn--ghost"
          style={{ flex: 1 }}
          onClick={() => {
            const p: WorkoutPlan = {
              id: newId('plan'),
              name: 'NEW PLAN',
              schedule: Array.from({ length: 7 }, () => ({ type: 'rest' as const })),
            };
            store.savePlan(p);
            store.updateSettings({ activePlanId: p.id });
            setEditingSchedule(true);
          }}
        >
          + NEW PLAN
        </button>
        {plan && state.plans.length > 1 && (
          <button className="btn btn--ghost red" style={{ flex: 1 }} onClick={() => setDeletingPlan(true)}>
            DELETE ACTIVE PLAN
          </button>
        )}
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

      {editingSchedule && plan && <ScheduleEditor plan={plan} onClose={() => setEditingSchedule(false)} />}

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
          body="Past workouts are kept. Scheduled days using it become rest days."
          confirmLabel="DELETE"
          danger
          onConfirm={() => {
            store.deleteTemplate(deletingTpl);
            setDeletingTpl(null);
          }}
          onCancel={() => setDeletingTpl(null)}
        />
      )}
    </div>
  );
}

function ScheduleEditor({ plan, onClose }: { plan: WorkoutPlan; onClose: () => void }) {
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

function TemplateEditor({ template, onBack }: { template: WorkoutTemplate; onBack: () => void }) {
  const state = useAppState();
  const tpl = state.templates.find((t) => t.id === template.id) ?? template;
  const [adding, setAdding] = useState(false);
  const [configuring, setConfiguring] = useState<string | null>(null);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [name, setName] = useState(tpl.name);

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
              <div>{ex?.name ?? te.exerciseId}</div>
              <div className="tiny faint">
                {te.sets} × {te.repMin}–{te.repMax} · +{trimNum(te.increment)} · rest {te.restSec}s
              </div>
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
            save([
              ...tpl.exercises,
              {
                id: newId('te'),
                exerciseId: ex.id,
                sets: 3,
                repMin: 8,
                repMax: 15,
                restSec: ex.compound ? settings.compoundRestSec : settings.isolationRestSec,
                increment: settings.defaultIncrement,
                startWeight: 0,
              },
            ]);
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
  const num = (label: string, key: keyof TemplateExercise, step = 1, min = 0) => (
    <div className="spread mt8">
      <span className="small dim">{label}</span>
      <div className="stepper">
        <button
          style={{ width: 44, height: 44 }}
          onClick={() => setV({ ...v, [key]: Math.max(min, (v[key] as number) - step) })}
        >
          −
        </button>
        <span style={{ minWidth: 56, textAlign: 'center', fontWeight: 800, fontSize: 17 }}>
          {trimNum(v[key] as number)}
        </span>
        <button style={{ width: 44, height: 44 }} onClick={() => setV({ ...v, [key]: (v[key] as number) + step })}>
          +
        </button>
      </div>
    </div>
  );
  return (
    <Sheet onClose={onClose}>
      <div className="tiny faint">CONFIGURE</div>
      <div style={{ fontSize: 17, fontWeight: 800 }}>{ex?.name}</div>
      {num('SETS', 'sets', 1, 1)}
      {num('REP MIN', 'repMin', 1, 1)}
      {num('REP MAX', 'repMax', 1, 1)}
      {num('REST (SEC)', 'restSec', 15, 15)}
      {num('INCREMENT (LB)', 'increment', 2.5, 2.5)}
      {num(ex?.bodyweight ? 'START ADDED WT' : 'START WEIGHT', 'startWeight', 5, 0)}
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
