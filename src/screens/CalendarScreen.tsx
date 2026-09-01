import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import {
  addDays, formatLong, MONTH_NAMES, parseISO, toISODate, todayISO, weekStart, WEEKDAY_SHORT,
} from '../lib/dates';
import { currentStreak, dayInfo, periodStats } from '../lib/adherence';
import type { DayStatus } from '../lib/adherence';
import { Confirm, Sheet } from '../components/Sheet';
import { RepPicker } from '../components/RepPicker';
import { fmtWeightShort } from '../lib/format';
import type { WorkoutSession } from '../types';

const GLYPH: Record<DayStatus, { g: string; cls: string; label: string }> = {
  completed: { g: '✓', cls: 'green', label: 'completed' },
  'optional-completed': { g: '✓', cls: 'purple', label: 'optional completed' },
  missed: { g: '×', cls: 'red', label: 'missed' },
  upcoming: { g: '○', cls: 'dim', label: 'planned' },
  'optional-skipped': { g: '—', cls: 'faint', label: 'optional skipped' },
  rest: { g: '·', cls: 'faint', label: 'rest' },
  'before-start': { g: '', cls: 'faint', label: '' },
};

export function CalendarScreen() {
  const state = useAppState();
  const today = todayISO();
  const [monthAnchor, setMonthAnchor] = useState(() => today.slice(0, 7)); // YYYY-MM
  const [selected, setSelected] = useState<string | null>(null);

  const plan = store.activePlan();
  const ctx = { plan, sessions: state.sessions, boxing: state.boxing, startDate: state.settings.startDate };

  const [yy, mm] = monthAnchor.split('-').map(Number);
  const firstOfMonth = `${monthAnchor}-01`;
  const daysInMonth = new Date(yy, mm, 0).getDate();
  const gridStart = weekStart(firstOfMonth);

  const cells = useMemo(() => {
    const out: string[] = [];
    let d = gridStart;
    for (let i = 0; i < 42; i++) {
      out.push(d);
      d = addDays(d, 1);
    }
    // trim trailing full weeks outside the month
    while (out.length > 7 && out[out.length - 7].slice(0, 7) !== monthAnchor) out.splice(-7);
    return out;
  }, [gridStart, monthAnchor]);

  const weekStats = periodStats(weekStart(today), addDays(weekStart(today), 6), ctx);
  const monthEnd = toISODate(new Date(yy, mm, 0));
  const monthStats = periodStats(firstOfMonth, monthEnd, ctx);
  const streak = currentStreak(ctx);

  function shiftMonth(delta: number) {
    const d = parseISO(firstOfMonth);
    d.setMonth(d.getMonth() + delta);
    setMonthAnchor(toISODate(d).slice(0, 7));
  }

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

      {selected && <DaySheet date={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DaySheet({ date, onClose }: { date: string; onClose: () => void }) {
  const state = useAppState();
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const sessions = state.sessions.filter((s) => s.date === date && s.status === 'completed');
  const boxed = state.boxing.some((b) => b.date === date);
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
    if (session) {
      return <SessionEditor session={session} onClose={() => setEditingSession(null)} />;
    }
  }

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

      {boxed && (
        <div className="list-row">
          <span style={{ flex: 1 }}>
            BOXING <span className="green">✓ attended</span>
          </span>
          <button className="btn btn--ghost btn--small" onClick={() => store.undoBoxing(date)}>
            REMOVE
          </button>
        </div>
      )}
      {!boxed && !future && (
        <button className="btn btn--ghost mt8" style={{ width: '100%' }} onClick={() => store.logBoxing(date)}>
          + LOG BOXING FOR THIS DAY
        </button>
      )}

      {sessions.map((s) => (
        <div key={s.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
          <div className="spread">
            <div style={{ fontWeight: 800 }}>{s.name}</div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn--ghost btn--small" onClick={() => setEditingSession(s.id)}>
                EDIT
              </button>
              <button className="btn btn--ghost btn--small red" onClick={() => setDeleting(s.id)}>
                DEL
              </button>
            </div>
          </div>
          {s.exercises
            .filter((es) => es.sets.some((x) => x.reps != null))
            .map((es) => (
              <div key={es.id} className="tiny dim mt8">
                {es.name} · {fmtWeightShort(es)} × {es.sets.filter((x) => x.reps != null).map((x) => x.reps).join(', ')}
                {es.result === 'progress' && <span className="green"> ▲</span>}
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

/** Inline editor for a past session: tap a set to fix reps, remove accidental data. */
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
                <button
                  key={i}
                  className="chip"
                  onClick={() => setPick({ esId: e.id, setIdx: i })}
                >
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
