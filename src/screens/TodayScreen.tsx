import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import { addDays, formatShort, todayISO, weekStart, WEEKDAY_NAMES, weekdayIndex } from '../lib/dates';
import { weekPlanStats, currentStreak } from '../lib/adherence';
import { fmtWeightShort } from '../lib/format';
import { unlockAudio } from '../lib/sound';
import { Sheet } from '../components/Sheet';
import { movingAverage } from '../lib/progression';

export function TodayScreen({ onOpenWorkout }: { onOpenWorkout: (sessionId: string) => void }) {
  const state = useAppState();
  const [pickTemplate, setPickTemplate] = useState(false);
  const today = todayISO();
  const activity = store.activityFor(today);
  const active = store.activeSession();
  const plan = store.activePlan();

  const completedToday = state.sessions.filter((s) => s.date === today && s.status === 'completed');
  const boxedToday = state.boxing.some((b) => b.date === today);

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

  const bwTrend = useMemo(() => {
    const pts = state.measurements.map((m) => ({ date: m.date, value: m.weightLb }));
    if (pts.length < 2) return null;
    const ma = movingAverage(pts, state.settings.maWindowDays);
    const latest = ma[ma.length - 1];
    const prior = ma.length > 7 ? ma[ma.length - 8] : ma[0];
    return { current: latest.value, delta: Math.round((latest.value - prior.value) * 10) / 10 };
  }, [state.measurements, state.settings.maWindowDays]);

  const templateName =
    activity.type === 'workout' ? store.templateById(activity.templateId)?.name ?? 'WORKOUT' : null;
  const optional = 'optional' in activity && !!activity.optional;

  function startPlanned() {
    unlockAudio();
    if (activity.type !== 'workout') return;
    const id = store.startWorkout(activity.templateId);
    onOpenWorkout(id);
  }

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
              <button
                className="btn btn--primary mt16"
                onClick={() => {
                  unlockAudio();
                  store.logBoxing(today);
                }}
              >
                ATTENDED ✓
              </button>
            ) : (
              <div className="spread mt8">
                <div className="green small">Session logged. Nice work.</div>
                <button className="btn btn--ghost btn--small" onClick={() => store.undoBoxing(today)}>
                  UNDO
                </button>
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
                      {es.result === 'progress' && <span className="green"> ▲</span>}
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

      {bwTrend && (
        <div className="spread mt16 dim small" style={{ padding: '0 4px' }}>
          <span className="tiny faint">BODY TREND ({state.settings.maWindowDays}D AVG)</span>
          <span>
            {bwTrend.current} lb{' '}
            <span className={bwTrend.delta <= 0 ? 'green' : 'amber'}>
              {bwTrend.delta > 0 ? '+' : ''}
              {bwTrend.delta}
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
              <span style={{ flex: 1 }}>{t.name}</span>
              <span className="faint tiny">{t.exercises.length} EXERCISES</span>
            </button>
          ))}
          {!boxedToday && (
            <button
              className="list-row"
              onClick={() => {
                store.logBoxing(today);
                setPickTemplate(false);
              }}
            >
              <span style={{ flex: 1 }}>BOXING (log attendance)</span>
            </button>
          )}
        </Sheet>
      )}
    </div>
  );
}
