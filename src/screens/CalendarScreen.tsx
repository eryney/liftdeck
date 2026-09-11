import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import {
  addDays, formatLong, formatWeekRange, MONTH_NAMES, parseISO, toISODate, todayISO, weekStart, WEEKDAY_SHORT,
} from '../lib/dates';
import { currentStreak, dayInfo, periodStats } from '../lib/adherence';
import type { DayStatus } from '../lib/adherence';
import { Confirm, Sheet } from '../components/Sheet';
import { RepPicker } from '../components/RepPicker';
import { BoxingDetailsSheet } from '../components/BoxingDetails';
import { fmtWeightShort } from '../lib/format';
import { dayRecord, foundationStreak, isFlexPlan, targetWeeks, weekAttainment, weekSummaryLine } from '../lib/flex';
import { isIncrease, resultLabel } from '../lib/progression';
import type { FlexWorkoutPlan, WorkoutSession } from '../types';

const GLYPH: Record<DayStatus, { g: string; cls: string; label: string }> = {
  completed: { g: '✓', cls: 'green', label: 'completed' },
  'optional-completed': { g: '✓', cls: 'purple', label: 'optional completed' },
  missed: { g: '×', cls: 'red', label: 'missed' },
  upcoming: { g: '○', cls: 'dim', label: 'planned' },
  'optional-skipped': { g: '—', cls: 'faint', label: 'optional skipped' },
  rest: { g: '·', cls: 'faint', label: 'rest' },
  'before-start': { g: '', cls: 'faint', label: '' },
};

function useMonthGrid(today: string) {
  const [monthAnchor, setMonthAnchor] = useState(() => today.slice(0, 7)); // YYYY-MM
  const [yy, mm] = monthAnchor.split('-').map(Number);
  const firstOfMonth = `${monthAnchor}-01`;
  const gridStart = weekStart(firstOfMonth);
  const cells = useMemo(() => {
    const out: string[] = [];
    let d = gridStart;
    for (let i = 0; i < 42; i++) {
      out.push(d);
      d = addDays(d, 1);
    }
    while (out.length > 7 && out[out.length - 7].slice(0, 7) !== monthAnchor) out.splice(-7);
    return out;
  }, [gridStart, monthAnchor]);
  function shiftMonth(delta: number) {
    const d = parseISO(firstOfMonth);
    d.setMonth(d.getMonth() + delta);
    setMonthAnchor(toISODate(d).slice(0, 7));
  }
  return { monthAnchor, yy, mm, firstOfMonth, cells, shiftMonth };
}

export function CalendarScreen() {
  const plan = store.activePlan();
  if (plan && isFlexPlan(plan)) return <FlexCalendar plan={plan} />;
  return <FixedCalendar />;
}

// ═══════════════════════════════════════════════════════════════════════════
// FLEX: training record. Blank days are neutral. Weeks are the adherence unit.
// ═══════════════════════════════════════════════════════════════════════════

function tagClass(tag: string): string {
  if (tag === 'BOX') return 't-box';
  if (tag === 'ACC') return 't-acc';
  return 't-str';
}

function FlexCalendar({ plan }: { plan: FlexWorkoutPlan }) {
  const state = useAppState();
  const today = todayISO();
  const { monthAnchor, yy, mm, cells, shiftMonth } = useMonthGrid(today);
  const [selected, setSelected] = useState<string | null>(null);
  const ctx = { plan, sessions: state.sessions, boxing: state.boxing, startDate: state.settings.startDate, today };

  const weekStarts = useMemo(() => cells.filter((_, i) => i % 7 === 0), [cells]);
  const streak = foundationStreak(ctx, today);
  const tw = targetWeeks(ctx, today);

  return (
    <div className="screen">
      <div className="topline">TRAINING RECORD</div>
      <h1 className="title">CALENDAR</h1>

      <div className="spread mt16">
        <button className="btn btn--ghost btn--small" onClick={() => shiftMonth(-1)} aria-label="previous month">
          ‹
        </button>
        <div style={{ fontWeight: 800, letterSpacing: '0.2em' }}>
          {MONTH_NAMES[mm - 1]} {yy}
        </div>
        <button className="btn btn--ghost btn--small" onClick={() => shiftMonth(1)} aria-label="next month">
          ›
        </button>
      </div>

      <div className="cal-grid">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w} className="cal-head">{w}</div>
        ))}
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === monthAnchor;
          const rec = dayRecord(d, ctx);
          const label = rec.tags.length ? rec.tags.join(' ').toLowerCase() : 'no training logged';
          return (
            <button
              key={d}
              className={`cal-cell ${d === today ? 'cal-cell--today' : ''} ${inMonth ? '' : 'cal-cell--out'} ${selected === d ? 'cal-cell--sel' : ''}`}
              onClick={() => setSelected(d)}
              aria-label={`${d} ${label}`}
              data-tags={rec.tags.join(',')}
            >
              <span>{Number(d.slice(8))}</span>
              <span className="tags" aria-hidden>
                {rec.tags.slice(0, 3).map((t, i) => (
                  <span key={i} className={tagClass(t)}>{t}</span>
                ))}
              </span>
            </button>
          );
        })}
      </div>

      <h2 className="section">WEEKS</h2>
      {weekStarts.map((ws) => {
        const w = weekAttainment(ctx, ws, state.templates);
        const isCurrent = ws === weekStart(today);
        const future = ws > today;
        return (
          <div key={ws} className={`week-row ${isCurrent ? 'week-row--current' : ''}`} data-testid="week-row">
            <span className="faint">{formatWeekRange(ws)}</span>
            <span className="dim">{future ? '' : weekSummaryLine(w)}</span>
            <span className={w.target ? 'cyan' : w.foundation ? 'green' : 'faint'} style={{ minWidth: 70, textAlign: 'right' }}>
              {future ? '' : w.target ? 'TARGET ✓' : w.foundation ? 'FOUND. ✓' : isCurrent ? 'OPEN' : '·'}
            </span>
          </div>
        );
      })}

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

      <div className="center faint tiny mt8">
        <span className="green">BOX</span> boxing · <span className="cyan">A / B</span> strength · <span className="purple">ACC</span> optional · blank days are rest, not misses
      </div>

      {selected && <FlexDaySheet plan={plan} date={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FlexDaySheet({ plan, date, onClose }: { plan: FlexWorkoutPlan; date: string; onClose: () => void }) {
  const state = useAppState();
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [boxDetails, setBoxDetails] = useState<string | null>(null);
  const rec = dayRecord(date, { plan, sessions: state.sessions, boxing: state.boxing });
  const future = date > todayISO();

  if (editingSession) {
    const session = state.sessions.find((s) => s.id === editingSession);
    if (session) return <SessionEditor session={session} onClose={() => setEditingSession(null)} />;
  }
  const bd = boxDetails ? state.boxing.find((b) => b.id === boxDetails) : null;
  if (bd) return <BoxingDetailsSheet record={bd} title="BOXING DETAILS" onClose={() => setBoxDetails(null)} />;

  return (
    <Sheet onClose={onClose}>
      <div className="tiny faint">{formatLong(date)}</div>
      <div className="spread mt8">
        <div style={{ fontSize: 18, fontWeight: 800 }}>{rec.tags.length ? rec.tags.join(' + ') : future ? 'UPCOMING' : 'REST'}</div>
        {!rec.tags.length && !future && <span className="faint tiny">nothing logged · that's fine</span>}
      </div>

      {rec.boxing.map((b) => (
        <div key={b.id} className="list-row">
          <span style={{ flex: 1 }}>
            BOXING <span className="green">✓</span>
            <div className="tiny faint">
              {b.sessionType ? b.sessionType.toUpperCase() : 'no details'}
              {b.durationMin ? ` · ${b.durationMin} MIN` : ''}
              {b.rpe ? ` · RPE ${b.rpe}` : ''}
            </div>
          </span>
          <button className="btn btn--ghost btn--small" onClick={() => setBoxDetails(b.id)}>DETAILS</button>
          <button className="btn btn--ghost btn--small" onClick={() => store.undoBoxing(date)}>REMOVE</button>
        </div>
      ))}
      {rec.boxing.length === 0 && !future && (
        <button className="btn btn--ghost mt8" style={{ width: '100%' }} onClick={() => store.logBoxing(date)}>
          + LOG BOXING FOR THIS DAY
        </button>
      )}

      {rec.sessions.map((s) => (
        <div key={s.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="spread">
            <div style={{ fontWeight: 800 }}>{s.name}</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn--ghost btn--small" onClick={() => setEditingSession(s.id)}>EDIT</button>
              <button className="btn btn--ghost btn--small red" onClick={() => setDeleting(s.id)}>DEL</button>
            </div>
          </div>
          {s.exercises
            .filter((es) => es.sets.some((x) => x.reps != null))
            .map((es) => {
              const lbl = resultLabel(es.result);
              return (
                <div key={es.id} className="tiny dim mt8">
                  {es.name} · {fmtWeightShort(es)} × {es.sets.filter((x) => x.reps != null).map((x) => x.reps).join(', ')}
                  {lbl.text && <span className={lbl.cls}> {lbl.glyph}</span>}
                </div>
              );
            })}
        </div>
      ))}

      {deleting && (
        <Confirm
          title="Delete this workout?"
          body="This removes it from history and affects progression suggestions."
          confirmLabel="DELETE"
          danger
          onConfirm={() => {
            store.deleteSession(deleting);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Sheet>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY fixed weekday calendar (unchanged)
// ═══════════════════════════════════════════════════════════════════════════

function FixedCalendar() {
  const state = useAppState();
  const today = todayISO();
  const { monthAnchor, yy, mm, firstOfMonth, cells, shiftMonth } = useMonthGrid(today);
  const [selected, setSelected] = useState<string | null>(null);

  const plan = store.activePlan();
  const ctx = { plan, sessions: state.sessions, boxing: state.boxing, startDate: state.settings.startDate };

  const weekStats = periodStats(weekStart(today), addDays(weekStart(today), 6), ctx);
  const monthEnd = toISODate(new Date(yy, mm, 0));
  const monthStats = periodStats(firstOfMonth, monthEnd, ctx);
  const streak = currentStreak(ctx);

  return (
    <div className="screen">
      <div className="topline">ADHERENCE LOG</div>
      <h1 className="title">CALENDAR</h1>

      <div className="spread mt16">
        <button className="btn btn--ghost btn--small" onClick={() => shiftMonth(-1)} aria-label="previous month">
          ‹
        </button>
        <div style={{ fontWeight: 800, letterSpacing: '0.2em' }}>
          {MONTH_NAMES[mm - 1]} {yy}
        </div>
        <button className="btn btn--ghost btn--small" onClick={() => shiftMonth(1)} aria-label="next month">
          ›
        </button>
      </div>

      <div className="cal-grid">
        {WEEKDAY_SHORT.map((w) => (
          <div key={w} className="cal-head">{w}</div>
        ))}
        {cells.map((d) => {
          const inMonth = d.slice(0, 7) === monthAnchor;
          const info = dayInfo(d, ctx);
          const glyph = GLYPH[info.status];
          return (
            <button
              key={d}
              className={`cal-cell ${d === today ? 'cal-cell--today' : ''} ${inMonth ? '' : 'cal-cell--out'} ${selected === d ? 'cal-cell--sel' : ''}`}
              onClick={() => setSelected(d)}
              aria-label={`${d} ${glyph.label}`}
            >
              <span>{Number(d.slice(8))}</span>
              <span className={`glyph ${glyph.cls}`} aria-hidden>
                {glyph.g || ' '}
              </span>
            </button>
          );
        })}
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="num">
            {weekStats.completed}/{weekStats.required || 0}
          </div>
          <div className="lbl">THIS WEEK</div>
        </div>
        <div className="stat">
          <div className="num">
            {monthStats.completed}/{monthStats.required || 0}
          </div>
          <div className="lbl">THIS MONTH</div>
        </div>
        <div className="stat">
          <div className="num">{streak}</div>
          <div className="lbl">STREAK</div>
        </div>
      </div>
      <div className="center faint tiny mt8">
        {monthStats.required > 0
          ? `${monthStats.completed} / ${monthStats.required} planned sessions completed this month (${Math.round((monthStats.completed / monthStats.required) * 100)}%)`
          : 'no planned sessions this month yet'}
        {monthStats.optionalCompleted > 0 ? ` · +${monthStats.optionalCompleted} optional` : ''}
      </div>

      <div className="center faint tiny mt8">
        <span className="green">✓</span> done · <span className="red">×</span> missed · <span className="dim">○</span> planned ·{' '}
        <span className="purple">✓</span> optional/extra
      </div>

      {selected && <FixedDaySheet date={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function FixedDaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const state = useAppState();
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [boxDetails, setBoxDetails] = useState<string | null>(null);
  const sessions = state.sessions.filter((s) => s.date === date && s.status === 'completed');
  const boxedRec = state.boxing.find((b) => b.date === date) ?? null;
  const info = dayInfo(date, {
    plan: store.activePlan(),
    sessions: state.sessions,
    boxing: state.boxing,
    startDate: state.settings.startDate,
  });
  const glyph = GLYPH[info.status];
  const future = date > todayISO();

  if (editingSession) {
    const session = state.sessions.find((s) => s.id === editingSession);
    if (session) return <SessionEditor session={session} onClose={() => setEditingSession(null)} />;
  }
  const bd = boxDetails ? state.boxing.find((b) => b.id === boxDetails) : null;
  if (bd) return <BoxingDetailsSheet record={bd} title="BOXING DETAILS" onClose={() => setBoxDetails(null)} />;

  return (
    <Sheet onClose={onClose}>
      <div className="tiny faint">{formatLong(date)}</div>
      <div className="spread mt8">
        <div style={{ fontSize: 18, fontWeight: 800 }}>
          {info.activity.type === 'rest'
            ? 'REST DAY'
            : info.activity.type === 'boxing'
              ? 'BOXING'
              : store.templateById(info.activity.templateId)?.name ?? 'WORKOUT'}
        </div>
        <div className={`badge ${info.status.includes('completed') ? 'badge--done' : ''}`}>
          <span className={glyph.cls}>{glyph.g}</span> {glyph.label.toUpperCase()}
        </div>
      </div>

      {boxedRec && (
        <div className="list-row">
          <span style={{ flex: 1 }}>
            BOXING <span className="green">✓ attended</span>
          </span>
          <button className="btn btn--ghost btn--small" onClick={() => setBoxDetails(boxedRec.id)}>DETAILS</button>
          <button className="btn btn--ghost btn--small" onClick={() => store.undoBoxing(date)}>REMOVE</button>
        </div>
      )}
      {!boxedRec && !future && (
        <button className="btn btn--ghost mt8" style={{ width: '100%' }} onClick={() => store.logBoxing(date)}>
          + LOG BOXING FOR THIS DAY
        </button>
      )}

      {sessions.map((s) => (
        <div key={s.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="spread">
            <div style={{ fontWeight: 800 }}>{s.name}</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn--ghost btn--small" onClick={() => setEditingSession(s.id)}>EDIT</button>
              <button className="btn btn--ghost btn--small red" onClick={() => setDeleting(s.id)}>DEL</button>
            </div>
          </div>
          {s.exercises
            .filter((es) => es.sets.some((x) => x.reps != null))
            .map((es) => (
              <div key={es.id} className="tiny dim mt8">
                {es.name} · {fmtWeightShort(es)} × {es.sets.filter((x) => x.reps != null).map((x) => x.reps).join(', ')}
                {isIncrease(es.result) && <span className="green"> ▲</span>}
              </div>
            ))}
        </div>
      ))}

      {deleting && (
        <Confirm
          title="Delete this workout?"
          body="This removes it from history and affects progression suggestions."
          confirmLabel="DELETE"
          danger
          onConfirm={() => {
            store.deleteSession(deleting);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Sheet>
  );
}

/** Inline editor for a past session: tap a set to fix reps. The snapshot's prescription/loads are never rewritten. */
function SessionEditor({ session, onClose }: { session: WorkoutSession; onClose: () => void }) {
  const [pick, setPick] = useState<{ esId: string; setIdx: number } | null>(null);
  const es = pick ? session.exercises.find((e) => e.id === pick.esId) : null;
  return (
    <Sheet onClose={onClose}>
      <div className="tiny faint">EDIT · {session.date}</div>
      <div style={{ fontSize: 18, fontWeight: 800 }}>{session.name}</div>
      <div style={{ maxHeight: '55dvh', overflowY: 'auto' }}>
        {session.exercises.map((e) => (
          <div key={e.id} className="mt16">
            <div className="small" style={{ fontWeight: 700 }}>
              {e.name} <span className="faint tiny">{fmtWeightShort(e)}</span>
            </div>
            <div className="row mt8" style={{ flexWrap: 'wrap', gap: 8 }}>
              {e.sets.map((set, i) => (
                <button key={i} className="chip" onClick={() => setPick({ esId: e.id, setIdx: i })}>
                  S{i + 1}: {set.reps ?? '—'}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <button className="btn btn--ghost mt16" style={{ width: '100%' }} onClick={onClose}>
        DONE
      </button>
      {pick && es && (
        <RepPicker
          exerciseName={es.name}
          setNumber={pick.setIdx + 1}
          repMin={es.repMin}
          repMax={es.repMax}
          current={es.sets[pick.setIdx]?.reps ?? null}
          onPick={(r) => {
            store.logSet(session.id, es.id, pick.setIdx, r);
            setPick(null);
          }}
          onClose={() => setPick(null)}
        />
      )}
    </Sheet>
  );
}
