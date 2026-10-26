import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import { formatShort, todayISO, WEEKDAY_NAMES, weekdayIndex } from '../lib/dates';
import { unlockAudio } from '../lib/sound';
import { Sheet } from '../components/Sheet';
import { weightTrend } from '../lib/body';
import { foundationStreak, rotationGoal, weekAttainment } from '../lib/flex';
import { recommend } from '../lib/recommend';
import { fmtTargets } from '../lib/prescribe';
import { detectStall } from '../lib/stall';
import { progressionById } from '../data/progressions';
import type { ExerciseSession, WorkoutTemplate } from '../types';

function titleCase(s: string): string {
  return s.length > 3 && s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s;
}

export function TodayScreen({ onOpenWorkout }: { onOpenWorkout: (sessionId: string) => void }) {
  const state = useAppState();
  const plan = store.activePlan();
  const [pickTemplate, setPickTemplate] = useState(false);
  const today = todayISO();
  const active = store.activeSession();

  const ctx = plan ? { plan, sessions: state.sessions, startDate: state.settings.startDate, today } : null;
  const week = useMemo(() => (ctx ? weekAttainment(ctx, today, state.templates) : null), [plan, state.sessions, state.templates, today]);
  const rec = useMemo(() => (plan ? recommend({ plan, sessions: state.sessions, templates: state.templates, today }) : null), [plan, state.sessions, state.templates, today]);
  const streak = ctx ? foundationStreak(ctx, today) : 0;
  const bw = useMemo(() => weightTrend(state.measurements, state.settings.maWindowDays), [state.measurements, state.settings.maWindowDays]);
  const completedToday = state.sessions.filter((s) => s.date === today && s.status === 'completed');

  const primaryTpl = rec && rec.primary.kind !== 'rest' ? store.templateById(rec.primary.templateId) : undefined;
  const nextTpl = rec?.strength.nextTemplateId ? store.templateById(rec.strength.nextTemplateId) : undefined;
  const optTpl = rec?.optional ? store.templateById(rec.optional.templateId) : undefined;
  const preview = useMemo(
    () => (!active && primaryTpl ? store.previewWorkout(primaryTpl.id) : []),
    [active?.id, primaryTpl?.id, state.sessions, state.exercises, state.templates],
  );
  const stalls = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const e of preview) if (detectStall(state.sessions, e.exerciseId, e.weight)) m.set(e.id, true);
    return m;
  }, [preview, state.sessions]);

  function start(templateId: string) {
    unlockAudio();
    onOpenWorkout(store.startWorkout(templateId));
  }

  if (!plan || !rec || !week) {
    return (
      <div className="screen">
        <div className="eyebrow">Today</div>
        <h1 className="title">No program</h1>
        <p className="muted">Restore the default program from Settings.</p>
      </div>
    );
  }

  const rot = rotationGoal(plan);
  const rotStat = rot ? week.goals.find((g) => g.goal.id === rot.id) : undefined;
  const optStat = week.goals.find((g) => g.optional);

  return (
    <div className="screen">
      <div className="spread">
        <div>
          <div className="eyebrow">{plan.name}</div>
          <h1 className="title">{titleCase(WEEKDAY_NAMES[weekdayIndex(today)])}</h1>
          <div className="muted small">{formatShort(today)}</div>
        </div>
        {rotStat && (
          <div className="col" style={{ alignItems: 'flex-end' }}>
            <div className="dots" data-testid="week-dots" aria-label={`${rotStat.count} of ${rotStat.target} sessions this week`}>
              {Array.from({ length: Math.max(rotStat.target, rotStat.count) }, (_, i) => (
                <span key={i} className={i < rotStat.count ? (i < rotStat.target ? 'on' : 'extra') : ''} />
              ))}
            </div>
            <div className="faint tiny">
              {rotStat.count} of {rotStat.target} this week
              {optStat && optStat.count > 0 ? ` · ${optStat.count} ${optStat.label.toLowerCase()}` : ''}
            </div>
          </div>
        )}
      </div>

      {/* ── next up ── */}
      <div className="card card--hero mt16" data-testid="recommended">
        {active ? (
          <>
            <div className="eyebrow">In progress</div>
            <div style={{ fontSize: 24, fontWeight: 800, marginTop: 2 }}>{active.name}</div>
            <div className="muted small">{active.exercises.filter((e) => e.sets.filter((s) => s.reps != null).length >= e.targetSets).length} of {active.exercises.length} exercises done</div>
            <button className="btn btn--green btn--block mt16" onClick={() => onOpenWorkout(active.id)}>
              Resume workout
            </button>
          </>
        ) : primaryTpl ? (
          <>
            <div className="eyebrow">{rec.primary.kind === 'bonus' ? 'Bonus session' : 'Next up'}</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>{primaryTpl.name}</div>
            <div className="muted small">
              {primaryTpl.subtitle ? `${primaryTpl.subtitle} · ` : ''}~{estimateMinutes(preview)} min
            </div>
            <div className="muted small mt4">{rec.primary.reason}</div>
            <button className="btn btn--primary btn--block mt16" onClick={() => start(primaryTpl.id)}>
              Start {primaryTpl.name}
            </button>
            {preview.length > 0 && <Preview preview={preview} stalls={stalls} />}
          </>
        ) : (
          <>
            <div className="eyebrow">Today</div>
            <div style={{ fontSize: 26, fontWeight: 800, marginTop: 2 }}>Rest</div>
            <div className="muted small mt4">{rec.primary.reason}</div>
            {rec.notes.map((n) => (
              <div key={n} className="faint tiny mt8">{n}</div>
            ))}
            {nextTpl && (
              <button className="btn btn--ghost btn--block mt16" onClick={() => start(nextTpl.id)}>
                Start {nextTpl.name} anyway
              </button>
            )}
          </>
        )}
      </div>

      {optTpl && rec.optional?.visible && !active && rec.primary.kind !== 'strength' && (
        <button className="btn btn--ghost btn--block mt12" onClick={() => start(optTpl.id)}>
          {optTpl.name} session · {optTpl.subtitle?.replace(' · optional', '').toLowerCase()}
        </button>
      )}

      {completedToday.length > 0 && (
        <div className="card mt16">
          <div className="eyebrow">Done today</div>
          {completedToday.map((s) => (
            <div key={s.id} className="mt8">
              <div className="bold">{s.name} ✓</div>
              {s.exercises
                .filter((es) => es.sets.some((x) => x.reps != null))
                .map((es) => (
                  <div key={es.id} className="muted small">
                    {es.name} · {es.sets.filter((x) => x.reps != null).map((x) => (es.timed ? `${x.reps}s` : x.reps)).join(', ')}
                    {es.result === 'increase' && <span className="green"> ▲</span>}
                  </div>
                ))}
            </div>
          ))}
        </div>
      )}

      {!active && (
        <button className="btn btn--ghost btn--block mt12" onClick={() => setPickTemplate(true)}>
          Start something else…
        </button>
      )}

      <div className="stat-grid">
        <div className="stat">
          <div className="num">{streak}</div>
          <div className="lbl">weeks in a row at {rot?.minimum ?? 3}+ sessions</div>
        </div>
        <div className="stat">
          <div className="num">{bw ? `${bw.avg}` : '—'}</div>
          <div className="lbl">
            {bw ? (
              <>
                lb · 7-day average
                {bw.change7 != null && <span className={bw.change7 <= 0 ? ' green' : ' amber'}> {bw.change7 > 0 ? '+' : ''}{bw.change7} / wk</span>}
              </>
            ) : (
              'log a weigh-in under History'
            )}
          </div>
        </div>
      </div>

      {pickTemplate && (
        <Sheet onClose={() => setPickTemplate(false)} title="Start a session">
          <div className="mt8">
            {state.templates.map((t) => {
              const isNext = t.id === rec.strength.nextTemplateId;
              return (
                <button
                  key={t.id}
                  className="list-row"
                  onClick={() => {
                    setPickTemplate(false);
                    start(t.id);
                  }}
                >
                  <span className="grow">
                    <span className="bold">{t.name}</span>
                    {t.subtitle && <span className="faint tiny" style={{ display: 'block' }}>{t.subtitle}</span>}
                  </span>
                  {isNext && <span className="pill pill--accent">next in rotation</span>}
                  <span className="faint tiny">{t.exercises.length} ex</span>
                </button>
              );
            })}
          </div>
          {rec.notes.map((n) => (
            <div key={n} className="faint tiny mt12">{n}</div>
          ))}
        </Sheet>
      )}
    </div>
  );
}

function estimateMinutes(preview: ExerciseSession[]): number {
  // warm-up + (work ≈ 35 s per set, timed sets ≈ target + 10 s) + rest per set; pairs rest once per set each
  let sec = 300;
  for (const e of preview) {
    const work = e.timed ? (e.targetReps?.[0] ?? 20) + 10 : 35;
    sec += e.targetSets * (work + e.restSec);
  }
  return Math.round(sec / 60 / 5) * 5;
}

function Preview({ preview, stalls }: { preview: ExerciseSession[]; stalls: Map<string, boolean> }) {
  return (
    <div className="preview" data-testid="preview">
      {preview.map((e, i) => {
        const prev = preview[i - 1];
        const second = !!e.pairGroup && !!prev && prev.pairGroup === e.pairGroup;
        const chain = progressionById(e.progressionId);
        return (
          <div key={e.id} className={`preview__row ${second ? 'preview__row--pair2' : ''}`}>
            <div className="grow">
              <div className="preview__name">
                {e.name}
                {e.variationBasis === 'advance' && <span className="pill pill--green" style={{ marginLeft: 8 }}>new rung</span>}
                {e.variationBasis === 'regress' && <span className="pill pill--amber" style={{ marginLeft: 8 }}>easier rung</span>}
                {e.variationBasis === 'top' && <span className="pill pill--green" style={{ marginLeft: 8 }}>add load</span>}
                {stalls.get(e.id) && <span className="pill pill--amber" style={{ marginLeft: 8 }}>stalled</span>}
              </div>
              <div className="preview__sub">
                {chain ? `${chain.name} · rung ${(e.level ?? 0) + 1} of ${e.levelCount}` : e.timed ? 'hold' : 'reps'}
                {e.perSide ? ' · each side' : ''}
                {e.weight > 0 ? ` · +${e.weight} lb` : ''}
              </div>
            </div>
            <div className="preview__nums">{fmtTargets(e.targetReps, e.timed)}</div>
          </div>
        );
      })}
    </div>
  );
}

export function templateTitle(t: WorkoutTemplate | undefined, fallback = 'Workout'): string {
  if (!t) return fallback;
  return t.name;
}
