import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import { addDays, formatShort, todayISO, weekStart, WEEKDAY_NAMES, weekdayIndex } from '../lib/dates';
import { weekPlanStats, currentStreak } from '../lib/adherence';
import { fmtWeightShort } from '../lib/format';
import { unlockAudio } from '../lib/sound';
import { Sheet } from '../components/Sheet';
import { GoalBar } from '../components/GoalBar';
import { BoxingDetailsSheet } from '../components/BoxingDetails';
import { weightTrend } from '../lib/body';
import { boxingGoal, foundationStreak, isFlexPlan, targetWeeks, weekAttainment } from '../lib/flex';
import { recommend } from '../lib/recommend';
import { boxingWeekStats } from '../lib/boxing';
import { isIncrease } from '../lib/progression';
import { fmtRepList } from '../lib/format';
import { fmtTargets } from '../lib/prescribe';
import { fmtRest, slotLabels } from '../lib/pairs';
import type { FixedWorkoutPlan, FlexWorkoutPlan, WorkoutTemplate } from '../types';

export function TodayScreen({ onOpenWorkout }: { onOpenWorkout: (sessionId: string) => void }) {
  const plan = store.activePlan();
  if (plan && isFlexPlan(plan)) return <FlexToday plan={plan} onOpenWorkout={onOpenWorkout} />;
  return <FixedToday plan={plan} onOpenWorkout={onOpenWorkout} />;
}

function templateTitle(t: WorkoutTemplate | undefined, fallback = 'WORKOUT'): string {
  if (!t) return fallback;
  return t.subtitle ? `${t.name} // ${t.subtitle}` : t.name;
}

// ═══════════════════════════════════════════════════════════════════════════
// FLEX plan: weekly attainment + recommendation, no weekday judgement
// ═══════════════════════════════════════════════════════════════════════════

function FlexToday({ plan, onOpenWorkout }: { plan: FlexWorkoutPlan; onOpenWorkout: (id: string) => void }) {
  const state = useAppState();
  const [pickTemplate, setPickTemplate] = useState(false);
  const [detailsFor, setDetailsFor] = useState<string | null>(null); // boxing record id
  const today = todayISO();
  const active = store.activeSession();

  const ctx = { plan, sessions: state.sessions, boxing: state.boxing, startDate: state.settings.startDate, today };
  const week = useMemo(() => weekAttainment(ctx, today, state.templates), [plan, state.sessions, state.boxing, state.templates, today]);
  const rec = useMemo(
    () => recommend({ plan, sessions: state.sessions, boxing: state.boxing, templates: state.templates, today }),
    [plan, state.sessions, state.boxing, state.templates, today],
  );
  const streak = foundationStreak(ctx, today);
  const tw = targetWeeks(ctx, today);
  const boxedTodayRec = state.boxing.find((b) => b.date === today) ?? null;
  const boxStats = boxingWeekStats(state.boxing, weekStart(today));
  const bw = useMemo(() => weightTrend(state.measurements, state.settings.maWindowDays), [state.measurements, state.settings.maWindowDays]);
  const completedToday = state.sessions.filter((s) => s.date === today && s.status === 'completed');

  const nextTpl = rec.strength.nextTemplateId ? store.templateById(rec.strength.nextTemplateId) : undefined;
  const accTpl = rec.accessory ? store.templateById(rec.accessory.templateId) : undefined;
  const hasBoxing = !!boxingGoal(plan);
  const liftNotes = rec.notes.filter((n) => n.id !== 'same-day' && (hasBoxing || n.id !== 'hard-boxing'));
  const sameDay = hasBoxing ? rec.notes.find((n) => n.id === 'same-day') : undefined;

  function start(templateId: string) {
    unlockAudio();
    onOpenWorkout(store.startWorkout(templateId));
  }

  function logBoxing() {
    unlockAudio();
    const r = store.logBoxing(today);
    setDetailsFor(r.id);
  }

  const detailsRec = detailsFor ? state.boxing.find((b) => b.id === detailsFor) : null;

  const primaryIsStrength = rec.primary.kind === 'strength';
  const primaryTpl = rec.primary.kind === 'strength' || rec.primary.kind === 'accessory' ? store.templateById(rec.primary.templateId) : undefined;
  const preview = useMemo(
    () => (!active && primaryTpl ? store.previewWorkout(primaryTpl.id) : []),
    [active?.id, primaryTpl?.id, state.sessions, state.exercises, state.templates],
  );

  return (
    <div className="screen">
      <div className="topline">LIFTDECK // {plan.name}</div>
      <h1 className="title">THIS WEEK</h1>
      <div className="dim small">
        {WEEKDAY_NAMES[weekdayIndex(today)]} · {formatShort(today)}
      </div>

      <div className="panel mt16" data-testid="week-panel">
        {week.goals.map((g) => (
          <GoalBar key={g.goal.id} g={g} />
        ))}
        <div className="status-line" data-testid="week-status">
          <span className={week.foundation ? 'green' : 'dim'}>FOUNDATION {week.foundation ? '✓' : 'IN PROGRESS'}</span>
          <span className={week.target ? 'cyan' : 'faint'}>TARGET {week.target ? '✓' : 'IN PROGRESS'}</span>
        </div>
      </div>

      {/* ── recommended next ── */}
      <div className="today-hero mt16" data-testid="recommended">
        <div className="badge">RECOMMENDED NEXT</div>
        {active ? (
          <>
            <div className="activity">{active.name}</div>
            <div className="dim small">Session in progress.</div>
            <button className="btn btn--green mt16" onClick={() => onOpenWorkout(active.id)}>
              RESUME WORKOUT ▸
            </button>
          </>
        ) : rec.primary.kind === 'boxing' ? (
          <>
            <div className="activity">BOXING</div>
            <div className="dim small">{rec.primary.reason}</div>
            {boxedTodayRec ? (
              <div className="green small mt16">Boxing logged today ✓ · a second session still counts once</div>
            ) : (
              <button className="btn btn--primary mt16" onClick={logBoxing}>
                BOXING DONE ✓
              </button>
            )}
            {nextTpl && !rec.strength.gapOk ? null : nextTpl && rec.strength.count < rec.strength.target && (
              <button className="btn btn--ghost mt8" style={{ width: '100%' }} onClick={() => start(nextTpl.id)}>
                OR START {nextTpl.name} ▸
              </button>
            )}
          </>
        ) : rec.primary.kind === 'strength' || rec.primary.kind === 'accessory' ? (
          <>
            <div className={`activity ${templateTitle(primaryTpl).length > 14 ? 'activity--long' : ''}`}>
              {rec.primary.kind === 'accessory' ? `BONUS // ${primaryTpl?.subtitle ?? primaryTpl?.name ?? ''}` : templateTitle(primaryTpl)}
            </div>
            <div className="dim small">{rec.primary.reason}</div>
            <button className="btn btn--primary mt16" onClick={() => start(rec.primary.kind === 'strength' || rec.primary.kind === 'accessory' ? rec.primary.templateId : '')}>
              START {primaryTpl?.name ?? 'WORKOUT'} ▸
            </button>
            {liftNotes.map((n) => (
              <div key={n.id} className="note">{n.text}</div>
            ))}
            {preview.length > 0 && (() => {
              const labels = slotLabels(preview);
              const pairs = preview.filter((e) => e.pairGroup).length;
              return (
                <div className="preview mt16" data-testid="preview">
                  <div className="tiny faint">TODAY'S CARD · {preview.length} EXERCISES{pairs > 0 ? ' · SUPERSETS: ALTERNATE A1 ⇄ A2, REST BETWEEN' : ''}</div>
                  {preview.map((e, i) => {
                    const l = labels[i];
                    const startsGroup = l.group && l.pos === 0;
                    return (
                      <div key={e.id} className={`preview__row ${l.group ? 'preview__row--pair' : ''} ${startsGroup ? 'preview__row--first' : ''}`}>
                        <span className={`slot-tag ${l.group ? 'slot-tag--pair' : ''}`}>{l.tag}</span>
                        <span className="preview__name">
                          {e.name}
                          {e.variationBasis === 'advance' && <span className="green tiny"> ▲ NEW RUNG</span>}
                          {e.variationBasis === 'regress' && <span className="amber tiny"> ↓ STEP BACK</span>}
                          {e.variationBasis === 'top' && <span className="green tiny"> ▲ +LOAD</span>}
                          <div className="tiny faint">
                            {e.timed ? 'hold' : 'reps'}{e.perSide ? ' · each side' : ''} · rest {fmtRest(e.restSec)}
                          </div>
                        </span>
                        <span className="preview__nums">{fmtTargets(e.targetReps, e.timed)}</span>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </>
        ) : (
          <>
            <div className="activity">RECOVERY</div>
            <div className="dim small">{rec.primary.reason}</div>
            <div className="faint tiny mt8">Rest is not a failed activity.{hasBoxing ? ' Boxing is always available below.' : accTpl ? ' The optional session is always available below.' : ''}</div>
          </>
        )}
        {sameDay && !active && (rec.primary.kind === 'strength' || (rec.primary.kind !== 'boxing' && !!boxedTodayRec)) && (
          <div className="note note--info">{sameDay.text}</div>
        )}
      </div>

      {/* ── boxing always available (plans with a boxing goal) ── */}
      {hasBoxing && rec.primary.kind !== 'boxing' && !active && (
        <div className="mt16">
          {boxedTodayRec ? (
            <div className="panel spread">
              <div>
                <div className="green small" style={{ fontWeight: 700, letterSpacing: '0.1em' }}>BOXING LOGGED ✓</div>
                <div className="tiny faint">
                  {boxedTodayRec.sessionType ? boxedTodayRec.sessionType.toUpperCase() : 'no details'}
                  {boxedTodayRec.durationMin ? ` · ${boxedTodayRec.durationMin} MIN` : ''}
                  {boxedTodayRec.rpe ? ` · RPE ${boxedTodayRec.rpe}` : ''}
                </div>
              </div>
              <div className="row" style={{ gap: 6 }}>
                <button className="btn btn--ghost btn--small" onClick={() => setDetailsFor(boxedTodayRec.id)}>DETAILS</button>
                <button className="btn btn--ghost btn--small" onClick={() => store.undoBoxing(today)}>UNDO</button>
              </div>
            </div>
          ) : (
            <button className="btn btn--green" onClick={logBoxing}>
              BOXING DONE ✓
            </button>
          )}
        </div>
      )}
      {rec.primary.kind === 'boxing' && boxedTodayRec && !active && (
        <div className="spread mt8" style={{ padding: '0 4px' }}>
          <span className="tiny faint" style={{ flex: 1 }}>
            {boxedTodayRec.sessionType ? boxedTodayRec.sessionType.toUpperCase() : 'no details'}
            {boxedTodayRec.durationMin ? ` · ${boxedTodayRec.durationMin} MIN` : ''}
            {boxedTodayRec.rpe ? ` · RPE ${boxedTodayRec.rpe}` : ''}
          </span>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn--ghost btn--small" onClick={() => setDetailsFor(boxedTodayRec.id)}>DETAILS</button>
            <button className="btn btn--ghost btn--small" onClick={() => store.undoBoxing(today)}>UNDO</button>
          </div>
        </div>
      )}

      {accTpl && rec.accessory && rec.primary.kind !== 'accessory' && !active && rec.accessory.visible && (
        <button className="btn btn--ghost mt8" style={{ width: '100%' }} onClick={() => start(accTpl.id)}>
          OR {accTpl.name} // {accTpl.subtitle ?? 'OPTIONAL'} ▸ <span className="faint tiny">{rec.accessory.count}/{rec.accessory.max ?? '∞'} this week</span>
        </button>
      )}

      {completedToday.length > 0 && (
        <div className="panel mt16">
          <div className="tiny faint">DONE TODAY</div>
          {completedToday.map((s) => (
            <div key={s.id} className="mt8">
              <div className="small" style={{ fontWeight: 700 }}>{s.name} ✓</div>
              {s.exercises
                .filter((es) => es.sets.some((x) => x.reps != null))
                .map((es) => (
                  <div key={es.id} className="tiny dim">
                    {es.name} · {fmtWeightShort(es)} × {fmtRepList(es.sets.map((x) => x.reps), es.timed)}
                    {isIncrease(es.result) && <span className="green"> ▲</span>}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {!active && (
        <button className="btn btn--ghost mt16" style={{ width: '100%' }} onClick={() => setPickTemplate(true)}>
          START SOMETHING ELSE…
        </button>
      )}

      {/* ── streaks (weekly, not daily) ── */}
      <div className="stat-grid stat-grid--2">
        <div className="stat">
          <div className="num">{streak}</div>
          <div className="lbl">FOUNDATION STREAK · WEEKS</div>
        </div>
        <div className="stat">
          <div className="num">
            {tw.hit}
            <span className="faint" style={{ fontSize: 13 }}> of {tw.of || 8}</span>
          </div>
          <div className="lbl">TARGET WEEKS · LAST 8</div>
        </div>
      </div>

      {/* ── secondary telemetry ── */}
      <div className="mt16" style={{ padding: '0 4px' }}>
        {hasBoxing && (boxStats.minutes != null || boxStats.load != null) && (
          <div className="spread dim small">
            <span className="tiny faint">BOXING THIS WEEK</span>
            <span>
              {boxStats.minutes != null ? `${boxStats.minutes} MIN` : ''}
              {boxStats.minutes != null && boxStats.load != null ? ' · ' : ''}
              {boxStats.load != null ? `LOAD ${boxStats.load}` : ''}
            </span>
          </div>
        )}
        {bw && (
          <div className="spread dim small mt8">
            <span className="tiny faint">BODY {state.settings.maWindowDays}D AVG</span>
            <span>
              {bw.avg} lb{' '}
              {bw.change7 != null && (
                <span className={bw.change7 <= 0 ? 'green' : 'amber'}>
                  {bw.change7 > 0 ? '+' : ''}
                  {bw.change7} / 7d
                </span>
              )}
            </span>
          </div>
        )}
      </div>

      {pickTemplate && (
        <Sheet onClose={() => setPickTemplate(false)}>
          <div className="tiny faint">START SESSION</div>
          {liftNotes.map((n) => (
            <div key={n.id} className="note">{n.text}</div>
          ))}
          {state.templates.map((t) => {
            const isNext = t.id === rec.strength.nextTemplateId;
            const isAcc = !!accTpl && t.id === accTpl.id;
            return (
              <button
                key={t.id}
                className="list-row"
                onClick={() => {
                  setPickTemplate(false);
                  start(t.id);
                }}
              >
                <span style={{ flex: 1 }}>
                  {templateTitle(t)}
                  {isNext && <span className="cyan tiny"> · NEXT IN ROTATION</span>}
                  {isAcc && <span className="purple tiny"> · OPTIONAL</span>}
                </span>
                <span className="faint tiny">{t.exercises.length} EX</span>
              </button>
            );
          })}
          {hasBoxing && !boxedTodayRec && (
            <button
              className="list-row"
              onClick={() => {
                setPickTemplate(false);
                logBoxing();
              }}
            >
              <span style={{ flex: 1 }}>BOXING (log attendance)</span>
            </button>
          )}
        </Sheet>
      )}

      {detailsRec && <BoxingDetailsSheet record={detailsRec} onClose={() => setDetailsFor(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY fixed weekday plan (unchanged behaviour)
// ═══════════════════════════════════════════════════════════════════════════

function FixedToday({ plan, onOpenWorkout }: { plan: FixedWorkoutPlan | null; onOpenWorkout: (sessionId: string) => void }) {
  const state = useAppState();
  const [pickTemplate, setPickTemplate] = useState(false);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const today = todayISO();
  const activity = store.activityFor(today);
  const active = store.activeSession();

  const completedToday = state.sessions.filter((s) => s.date === today && s.status === 'completed');
  const boxedTodayRec = state.boxing.find((b) => b.date === today) ?? null;
  const boxedToday = !!boxedTodayRec;

  const ctx = { plan, sessions: state.sessions, boxing: state.boxing, startDate: state.settings.startDate };
  const week = weekPlanStats(ctx, today);
  const streak = currentStreak(ctx, today);

  const weekCells = useMemo(() => {
    const start = weekStart(today);
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(start, i);
      const a = plan ? plan.schedule[weekdayIndex(d)] : { type: 'rest' as const };
      if (a.type === 'rest' || ('optional' in a && a.optional)) return null;
      const done =
        a.type === 'boxing'
          ? state.boxing.some((b) => b.date === d)
          : state.sessions.some((s) => s.date === d && s.status === 'completed');
      return done;
    }).filter((x): x is boolean => x !== null);
  }, [plan, state.boxing, state.sessions, today]);

  const bw = useMemo(() => weightTrend(state.measurements, state.settings.maWindowDays), [state.measurements, state.settings.maWindowDays]);

  const templateName =
    activity.type === 'workout' ? store.templateById(activity.templateId)?.name ?? 'WORKOUT' : null;
  const optional = 'optional' in activity && !!activity.optional;

  function startPlanned() {
    unlockAudio();
    if (activity.type !== 'workout') return;
    const id = store.startWorkout(activity.templateId);
    onOpenWorkout(id);
  }

  function logBoxing() {
    unlockAudio();
    const r = store.logBoxing(today);
    setDetailsFor(r.id);
  }

  const detailsRec = detailsFor ? state.boxing.find((b) => b.id === detailsFor) : null;

  return (
    <div className="screen">
      <div className="topline">LIFTDECK // {plan?.name ?? 'NO PLAN'}</div>
      <h1 className="title">{WEEKDAY_NAMES[weekdayIndex(today)]}</h1>
      <div className="dim small">{formatShort(today)}</div>

      <div className="today-hero mt16">
        {activity.type === 'rest' && (
          <>
            <div className="badge">REST DAY</div>
            <div className="activity">RECOVER</div>
            <div className="dim small">Nothing scheduled. The plan resumes tomorrow.</div>
          </>
        )}

        {activity.type === 'boxing' && (
          <>
            <div className={`badge ${boxedToday ? 'badge--done' : ''}`}>
              {boxedToday ? '✓ COMPLETE' : 'PLANNED'}
            </div>
            <div className="activity">BOXING</div>
            {!boxedToday ? (
              <button className="btn btn--primary mt16" onClick={logBoxing}>
                BOXING DONE ✓
              </button>
            ) : (
              <div className="spread mt8">
                <div className="green small">Session logged. Nice work.</div>
                <div className="row" style={{ gap: 6 }}>
                  <button className="btn btn--ghost btn--small" onClick={() => setDetailsFor(boxedTodayRec!.id)}>DETAILS</button>
                  <button className="btn btn--ghost btn--small" onClick={() => store.undoBoxing(today)}>UNDO</button>
                </div>
              </div>
            )}
          </>
        )}

        {activity.type === 'workout' && (
          <>
            <div className={`badge ${completedToday.length > 0 ? 'badge--done' : optional ? 'badge--optional' : ''}`}>
              {completedToday.length > 0 ? '✓ COMPLETE' : optional ? 'OPTIONAL' : 'PLANNED'}
            </div>
            <div className="activity">{templateName}</div>
            {completedToday.length > 0 ? (
              <div className="mt8">
                {completedToday[0].exercises
                  .filter((es) => es.sets.some((s) => s.reps != null))
                  .map((es) => (
                    <div key={es.id} className="small dim">
                      {es.name} · {fmtWeightShort(es)} ×{' '}
                      {es.sets.filter((s) => s.reps != null).map((s) => s.reps).join(', ')}
                      {isIncrease(es.result) && <span className="green"> ▲</span>}
                    </div>
                  ))}
              </div>
            ) : active ? (
              <button className="btn btn--green mt16" onClick={() => onOpenWorkout(active.id)}>
                RESUME WORKOUT ▸
              </button>
            ) : (
              <button className="btn btn--primary mt16" onClick={startPlanned}>
                START WORKOUT ▸
              </button>
            )}
            {optional && completedToday.length === 0 && (
              <div className="faint tiny mt8">Optional session — skipping doesn't hurt your streak.</div>
            )}
          </>
        )}

        {active && activity.type !== 'workout' && (
          <button className="btn btn--green mt16" onClick={() => onOpenWorkout(active.id)}>
            RESUME WORKOUT ▸
          </button>
        )}
      </div>

      <h2 className="section">THIS WEEK</h2>
      <div className="panel">
        <div className="spread">
          <div>
            <span style={{ fontSize: 22, fontWeight: 800 }} className="cyan">
              {week.completed} / {week.planned}
            </span>{' '}
            <span className="dim small">planned sessions</span>
          </div>
          {streak > 0 && (
            <div className="tiny dim">
              STREAK <span className="green" style={{ fontSize: 15, fontWeight: 800 }}>{streak}</span>
            </div>
          )}
        </div>
        <div className="weekbar" aria-hidden>
          {weekCells.map((done, i) => (
            <span key={i} className={done ? 'done' : ''} />
          ))}
        </div>
      </div>

      {bw && bw.change7 != null && (
        <div className="spread mt16 dim small" style={{ padding: '0 4px' }}>
          <span className="tiny faint">BODY TREND ({state.settings.maWindowDays}D AVG)</span>
          <span>
            {bw.avg} lb{' '}
            <span className={bw.change7 <= 0 ? 'green' : 'amber'}>
              {bw.change7 > 0 ? '+' : ''}
              {bw.change7}
            </span>
          </span>
        </div>
      )}

      <button className="btn btn--ghost mt16" style={{ width: '100%' }} onClick={() => setPickTemplate(true)}>
        START A DIFFERENT SESSION…
      </button>

      {pickTemplate && (
        <Sheet onClose={() => setPickTemplate(false)}>
          <div className="tiny faint">START SESSION</div>
          {state.templates.map((t) => (
            <button
              key={t.id}
              className="list-row"
              onClick={() => {
                setPickTemplate(false);
                unlockAudio();
                onOpenWorkout(store.startWorkout(t.id));
              }}
            >
              <span style={{ flex: 1 }}>{templateTitle(t)}</span>
              <span className="faint tiny">{t.exercises.length} EXERCISES</span>
            </button>
          ))}
          {!boxedToday && (
            <button
              className="list-row"
              onClick={() => {
                setPickTemplate(false);
                logBoxing();
              }}
            >
              <span style={{ flex: 1 }}>BOXING (log attendance)</span>
            </button>
          )}
        </Sheet>
      )}

      {detailsRec && <BoxingDetailsSheet record={detailsRec} onClose={() => setDetailsFor(null)} />}
    </div>
  );
}
