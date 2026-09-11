import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import { LineChart } from '../components/LineChart';
import { bestSet, exerciseHistory, isIncrease, resultLabel } from '../lib/progression';
import { fmtWeightShort, trimNum } from '../lib/format';
import { formatDuration, formatShort, todayISO, weekStart, addDays, formatWeekRange } from '../lib/dates';
import { Confirm, Sheet } from '../components/Sheet';
import { fmtDelta, movingAverage, waistTrend, weightTrend } from '../lib/body';
import { strengthTrend, systemLoadHistory, trendLabelText } from '../lib/strength';
import { boxingLastWeeks, boxingLoad, boxingTypeLabel, boxingWeekStats, BOXING_TYPES } from '../lib/boxing';
import { boxingGoal, isFlexPlan, rotationGoal, weekAttainment } from '../lib/flex';
import { BoxingDetailsSheet } from '../components/BoxingDetails';

type SubView = 'overview' | 'lifts' | 'body' | 'boxing' | 'log';

const VIEWS: { id: SubView; label: string }[] = [
  { id: 'overview', label: 'OVERVIEW' },
  { id: 'lifts', label: 'LIFTS' },
  { id: 'body', label: 'BODY' },
  { id: 'boxing', label: 'BOXING' },
  { id: 'log', label: 'HISTORY' },
];

export function ProgressScreen() {
  const [view, setView] = useState<SubView>('overview');
  return (
    <div className="screen">
      <div className="topline">TELEMETRY</div>
      <h1 className="title">PROGRESS</h1>
      <div className="chip-row mt8">
        {VIEWS.map((v) => (
          <button key={v.id} className={`chip ${view === v.id ? 'on' : ''}`} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>
      {view === 'overview' && <OverviewView />}
      {view === 'lifts' && <LiftsView />}
      {view === 'body' && <BodyView />}
      {view === 'boxing' && <BoxingView />}
      {view === 'log' && <LogView />}
    </div>
  );
}

/** Exercise ids the active plan's strength templates prescribe (major tracked lifts), else everything performed. */
function useTrackedLifts() {
  const state = useAppState();
  return useMemo(() => {
    const plan = store.activePlan();
    const ids: string[] = [];
    if (plan && isFlexPlan(plan)) {
      const rg = rotationGoal(plan);
      for (const tid of rg?.templateIds ?? []) {
        for (const te of store.templateById(tid)?.exercises ?? []) if (!ids.includes(te.exerciseId)) ids.push(te.exerciseId);
      }
    }
    if (ids.length === 0) {
      const seen = new Map<string, number>();
      for (const s of state.sessions) {
        if (s.status !== 'completed') continue;
        for (const es of s.exercises) if (es.sets.some((x) => x.reps != null)) seen.set(es.exerciseId, Math.max(seen.get(es.exerciseId) ?? 0, s.startedAt));
      }
      ids.push(...[...seen.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id));
    }
    return ids;
  }, [state.sessions, state.templates, state.plans, state.settings.activePlanId]);
}

// ── OVERVIEW ──────────────────────────────────────────────────────────────

function OverviewView() {
  const state = useAppState();
  const today = todayISO();
  const plan = store.activePlan();
  const flex = plan && isFlexPlan(plan) ? plan : null;
  const week = flex ? weekAttainment({ plan: flex, sessions: state.sessions, boxing: state.boxing, today }, today, state.templates) : null;
  const bw = weightTrend(state.measurements, state.settings.maWindowDays);
  const waist = waistTrend(state.measurements);
  const tracked = useTrackedLifts();
  const trends = tracked
    .map((id) => ({ id, name: store.exerciseById(id)?.name ?? id, t: strengthTrend(state.sessions, id, state.measurements) }))
    .filter((x) => x.t.points.length > 0);
  const goalDate = state.settings.goalMode === 'cut' ? state.settings.goalDate : undefined;

  return (
    <>
      <h2 className="section">THIS WEEK</h2>
      <div className="panel">
        {week ? (
          week.goals
            .filter((g) => !g.optional)
            .map((g) => (
              <div key={g.goal.id} className="spread mt8">
                <span className="small dim" style={{ letterSpacing: '0.16em' }}>{g.label}</span>
                <span style={{ fontWeight: 800 }} className={g.targetMet ? 'cyan' : g.minMet ? 'green' : ''}>
                  {g.count} <span className="faint">/ {g.target}</span>
                </span>
              </div>
            ))
        ) : (
          <div className="dim small">Weekly targets appear here for flex plans.</div>
        )}
        {week && (
          <div className="status-line">
            <span className={week.foundation ? 'green' : 'dim'}>FOUNDATION {week.foundation ? '✓' : 'IN PROGRESS'}</span>
            <span className={week.target ? 'cyan' : 'faint'}>TARGET {week.target ? '✓' : 'IN PROGRESS'}</span>
          </div>
        )}
      </div>

      <h2 className="section">BODY{goalDate ? ` · CUT → ${formatShort(goalDate)} ${goalDate.slice(0, 4)}` : ''}</h2>
      <div className="stat-grid stat-grid--2">
        <div className="stat">
          <div className="num">{bw ? bw.avg : '—'}</div>
          <div className="lbl">{state.settings.maWindowDays}D AVG · LB</div>
        </div>
        <div className="stat">
          <div className={`num ${bw?.lbPerWeek != null ? (bw.lbPerWeek <= 0 ? 'green' : 'amber') : ''}`}>{bw?.lbPerWeek != null ? fmtDelta(bw.lbPerWeek) : '—'}</div>
          <div className="lbl">TREND · LB / WEEK</div>
        </div>
        <div className="stat">
          <div className="num">{waist ? `${waist.latest}"` : '—'}</div>
          <div className="lbl">LATEST WAIST</div>
        </div>
        <div className="stat">
          <div className={`num ${waist?.change28 != null ? (waist.change28 <= 0 ? 'green' : 'amber') : ''}`}>{waist ? fmtDelta(waist.change28) : '—'}</div>
          <div className="lbl">WAIST · 4 WEEK</div>
        </div>
      </div>

      <h2 className="section">STRENGTH · ESTIMATED</h2>
      <div className="panel">
        {trends.length === 0 && <div className="dim small">Complete a few strength sessions and maintenance trends appear here.</div>}
        {trends.map(({ id, name, t }) => {
          const l = trendLabelText(t.label);
          return (
            <div key={id} className="spread mt8">
              <span className="small" style={{ flex: 1 }}>{name}</span>
              <span className={`tiny ${l.cls}`} style={{ letterSpacing: '0.12em', fontWeight: 700 }}>
                {l.glyph} {l.text}
              </span>
            </div>
          );
        })}
        <div className="faint tiny mt8">Rolling e1RM of the last 3 exposures vs the 3 before. Holding steady while the scale drops is the goal.</div>
      </div>
    </>
  );
}

// ── LIFTS ─────────────────────────────────────────────────────────────────

function LiftsView() {
  const state = useAppState();
  const performedIds = useMemo(() => {
    const ids = new Map<string, number>(); // id -> last performed timestamp
    for (const s of state.sessions) {
      if (s.status !== 'completed') continue;
      for (const es of s.exercises) {
        if (es.sets.some((x) => x.reps != null)) {
          ids.set(es.exerciseId, Math.max(ids.get(es.exerciseId) ?? 0, s.startedAt));
        }
      }
    }
    return [...ids.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [state.sessions]);

  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const selId = exerciseId ?? performedIds[0] ?? null;

  if (!selId) {
    return <div className="panel mt16 center dim small">Complete a workout and your lift charts appear here.</div>;
  }

  const history = exerciseHistory(state.sessions, selId);
  const ex = store.exerciseById(selId);
  const best = bestSet(state.sessions, selId);
  const first = history[0];
  const latest = history[history.length - 1];
  const weightPts = history.map((h) => ({ date: h.date, value: h.weight }));
  const trend = strengthTrend(state.sessions, selId, state.measurements);
  const tl = trendLabelText(trend.label);
  const sysLoad = ex?.bodyweight ? systemLoadHistory(state.sessions, selId, state.measurements) : [];

  return (
    <>
      <select className="mt16" value={selId} onChange={(e) => setExerciseId(e.target.value)} aria-label="exercise">
        {performedIds.map((id) => (
          <option key={id} value={id}>
            {store.exerciseById(id)?.name ?? id}
          </option>
        ))}
      </select>

      <div className="stat-grid">
        <div className="stat">
          <div className="num">{latest ? fmtWeightShort({ weight: latest.weight, bodyweight: ex?.bodyweight }) : '—'}</div>
          <div className="lbl">{ex?.bodyweight ? 'ADDED · CURRENT' : ex?.perHand ? 'PER HAND · CURRENT' : 'CURRENT'}</div>
        </div>
        <div className="stat">
          <div className="num">{first ? fmtWeightShort({ weight: first.weight, bodyweight: ex?.bodyweight }) : '—'}</div>
          <div className="lbl">STARTED</div>
        </div>
        <div className="stat">
          <div className="num">
            {latest && first ? (latest.weight - first.weight >= 0 ? '+' : '') + trimNum(latest.weight - first.weight) : '—'}
          </div>
          <div className="lbl">CHANGE</div>
        </div>
      </div>
      {best && (
        <div className="center faint tiny mt8">
          BEST SET · {fmtWeightShort({ weight: best.weight, bodyweight: ex?.bodyweight })} × {best.reps} on {formatShort(best.date)}
        </div>
      )}

      <div className="panel mt16">
        <div className="spread">
          <span className="tiny faint">STRENGTH MAINTENANCE · ESTIMATED 1RM{trend.systemLoad ? ' (TOTAL SYSTEM LOAD)' : ''}</span>
          <span className={`tiny ${tl.cls}`} style={{ fontWeight: 700, letterSpacing: '0.12em' }}>
            {tl.glyph} {tl.text}
          </span>
        </div>
        {trend.recent != null && (
          <div className="spread mt8 small">
            <span className="dim">last 3: <span className="cyan">{trend.recent}</span></span>
            <span className="dim">prior 3: {trend.prior ?? '—'}</span>
            <span className={tl.cls}>{trend.pct != null ? fmtDelta(trend.pct, '%') : ''}</span>
          </div>
        )}
        {ex?.bodyweight && !trend.systemLoad && (
          <div className="faint tiny mt8">Log body weight near your workouts to see total-system-load estimates for this lift.</div>
        )}
        {trend.points.length === 0 && !ex?.bodyweight && (
          <div className="faint tiny mt8">Needs work sets of 1–12 reps with external load.</div>
        )}
      </div>

      <h2 className="section">{ex?.bodyweight ? 'ADDED LOAD' : 'WORKING WEIGHT'} OVER TIME</h2>
      <LineChart series={[{ points: weightPts, color: 'var(--cyan)', dots: true }]} unit={ex?.perHand ? 'lb / hand' : 'lb'} />

      {trend.points.length > 1 && (
        <>
          <h2 className="section">ESTIMATED 1RM</h2>
          <LineChart series={[{ points: trend.points, color: 'var(--purple)', dots: true }]} unit="lb est." />
        </>
      )}

      {sysLoad.length > 0 && (
        <>
          <h2 className="section">TOTAL SYSTEM LOAD · BW + ADDED</h2>
          <LineChart series={[{ points: sysLoad.map((r) => ({ date: r.date, value: r.total })), color: 'var(--green)', dots: true }]} unit="lb" />
        </>
      )}

      <h2 className="section">RECENT SESSIONS</h2>
      {[...history].reverse().slice(0, 10).map((h, i) => {
        const lbl = resultLabel(h.result);
        return (
          <div key={i} className="spread panel mt8" style={{ padding: '10px 14px' }}>
            <span className="dim small">{formatShort(h.date)}</span>
            <span className="small">
              {fmtWeightShort({ weight: h.weight, bodyweight: ex?.bodyweight })} × {h.reps.join(', ')}
              {h.finalSetRir != null && <span className="faint tiny"> · RIR {h.finalSetRir}</span>}
            </span>
            <span className={`tiny ${lbl.cls}`}>{lbl.glyph} {lbl.text}</span>
          </div>
        );
      })}
    </>
  );
}

// ── BODY ──────────────────────────────────────────────────────────────────

function BodyView() {
  const state = useAppState();
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [date, setDate] = useState(todayISO());
  const [deleting, setDeleting] = useState<string | null>(null);

  const sorted = [...state.measurements].sort((a, b) => (a.date < b.date ? -1 : 1));
  const raw = sorted.map((m) => ({ date: m.date, value: m.weightLb }));
  const ma = movingAverage(raw, state.settings.maWindowDays);
  const latest = sorted[sorted.length - 1];
  const bw = weightTrend(state.measurements, state.settings.maWindowDays);
  const wt = waistTrend(state.measurements);
  const goal = state.settings;

  function save() {
    const w = Number(weight);
    const wa = waist ? Number(waist) : undefined;
    if ((!w || w <= 0) && !(wa && wa > 0)) return;
    const existing = state.measurements.find((m) => m.date === date);
    const weightToSave = w > 0 ? w : existing?.weightLb;
    if (!weightToSave) return; // waist-only entries need an existing weight for that date
    store.addMeasurement(date, weightToSave, wa);
    setWeight('');
    setWaist('');
    setDate(todayISO());
  }

  return (
    <>
      <div className="panel mt16">
        <div className="tiny faint">LOG BODY WEIGHT{goal.goalMode === 'cut' && goal.goalDate ? ` · CUT → ${formatShort(goal.goalDate)} ${goal.goalDate.slice(0, 4)}` : ''}</div>
        <div className="row mt8" style={{ gap: 8 }}>
          <input
            type="number"
            inputMode="decimal"
            placeholder={latest ? `${latest.weightLb} lb` : 'lb'}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            aria-label="body weight (lb)"
          />
          <input
            type="number"
            inputMode="decimal"
            placeholder="waist (in, opt.)"
            value={waist}
            onChange={(e) => setWaist(e.target.value)}
            aria-label="waist (inches)"
          />
        </div>
        <div className="row mt8" style={{ gap: 8 }}>
          <input type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} aria-label="date" />
          <button className="btn btn--primary" style={{ minHeight: 48, flex: 1 }} disabled={!weight && !waist} onClick={save}>
            SAVE
          </button>
        </div>
        <div className="faint tiny mt8">Weigh often, not necessarily daily. Waist: measure consistently at the same location/conditions.</div>
      </div>

      {bw && (
        <>
          <h2 className="section">WEIGHT TREND</h2>
          <div className="stat-grid stat-grid--2">
            <div className="stat">
              <div className="num">{bw.avg}</div>
              <div className="lbl">CURRENT {state.settings.maWindowDays}D AVG · LB</div>
            </div>
            <div className="stat">
              <div className={`num ${bw.change7 != null ? (bw.change7 <= 0 ? 'green' : 'amber') : ''}`}>{fmtDelta(bw.change7)}</div>
              <div className="lbl">7D CHANGE · LB</div>
            </div>
            <div className="stat">
              <div className={`num ${bw.change28 != null ? (bw.change28 <= 0 ? 'green' : 'amber') : ''}`}>{fmtDelta(bw.change28)}</div>
              <div className="lbl">4 WEEK CHANGE · LB</div>
            </div>
            <div className="stat">
              <div className={`num ${bw.lbPerWeek != null ? (bw.lbPerWeek <= 0 ? 'green' : 'amber') : ''}`}>{fmtDelta(bw.lbPerWeek)}</div>
              <div className="lbl">TREND · LB / WEEK</div>
            </div>
          </div>
          <div className="center faint tiny mt8">
            {bw.pctPerWeek != null ? (
              <>
                TREND {fmtDelta(bw.pctPerWeek)} % BODYWEIGHT / WEEK · regression over {bw.slopeSpanDays} days
              </>
            ) : (
              'Trend rate appears after ~1 week of readings.'
            )}
          </div>

          <h2 className="section">WEIGHT · RAW + {state.settings.maWindowDays}D AVERAGE</h2>
          <LineChart
            series={[
              { points: raw, color: 'var(--faint)', dots: true, dashed: true },
              { points: ma, color: 'var(--cyan)' },
            ]}
            unit="lb"
          />
          <div className="stat-grid stat-grid--2">
            <div className="stat">
              <div className="num">{latest.weightLb}</div>
              <div className="lbl">LATEST RAW · {formatShort(latest.date)}</div>
            </div>
            <div className="stat">
              <div className="num">{goal.goalWeightLb ?? '—'}</div>
              <div className="lbl">GOAL WEIGHT (OPTIONAL)</div>
            </div>
          </div>
        </>
      )}

      <h2 className="section">WAIST</h2>
      {wt ? (
        <>
          <div className="stat-grid stat-grid--2">
            <div className="stat">
              <div className="num">{wt.latest}"</div>
              <div className="lbl">LATEST WAIST · {formatShort(wt.latestDate)}</div>
            </div>
            <div className="stat">
              <div className={`num ${wt.change28 != null ? (wt.change28 <= 0 ? 'green' : 'amber') : ''}`}>{fmtDelta(wt.change28)}</div>
              <div className="lbl">4 WEEK CHANGE · IN</div>
            </div>
          </div>
          <h2 className="section">WAIST OVER TIME</h2>
          <LineChart series={[{ points: wt.points, color: 'var(--purple)', dots: true }]} unit="in" />
          {goal.goalWaistIn != null && <div className="center faint tiny mt8">GOAL WAIST {goal.goalWaistIn}" (set by you in SETTINGS)</div>}
        </>
      ) : (
        <div className="panel center dim small">No waist readings yet. Add one alongside a weigh-in.</div>
      )}

      {sorted.length > 0 && (
        <>
          <h2 className="section">ENTRIES</h2>
          {[...sorted].reverse().slice(0, 30).map((m) => (
            <div key={m.id} className="spread panel mt8" style={{ padding: '8px 14px' }}>
              <span className="dim small">{formatShort(m.date)}</span>
              <span className="small">
                {m.weightLb} lb{m.waistIn ? ` · ${m.waistIn}"` : ''}
              </span>
              <button className="btn btn--ghost btn--small" onClick={() => setDeleting(m.id)} aria-label="delete entry">
                ×
              </button>
            </div>
          ))}
        </>
      )}

      {deleting && (
        <Confirm
          title="Delete this entry?"
          confirmLabel="DELETE"
          danger
          onConfirm={() => {
            store.deleteMeasurement(deleting);
            setDeleting(null);
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </>
  );
}

// ── BOXING ────────────────────────────────────────────────────────────────

function BoxingView() {
  const state = useAppState();
  const today = todayISO();
  const plan = store.activePlan();
  const bg = plan && isFlexPlan(plan) ? boxingGoal(plan) : null;
  const target = bg?.target ?? 4;
  const thisWeek = boxingWeekStats(state.boxing, weekStart(today));
  const weeks = boxingLastWeeks(state.boxing, today, 8);
  const maxCount = Math.max(target, ...weeks.map((w) => w.count), 1);
  const [detailsFor, setDetailsFor] = useState<string | null>(null);
  const recent = [...state.boxing].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 12);
  const anyMeta = weeks.some((w) => w.minutes != null || Object.keys(w.types).length > 0);
  const typeTotals = BOXING_TYPES.map((t) => ({ ...t, n: state.boxing.filter((b) => b.sessionType === t.id).length })).filter((t) => t.n > 0);
  const detailsRec = detailsFor ? state.boxing.find((b) => b.id === detailsFor) : null;

  return (
    <>
      <div className="stat-grid stat-grid--2">
        <div className="stat">
          <div className={`num ${thisWeek.count >= target ? 'cyan' : thisWeek.count >= (bg?.minimum ?? 2) ? 'green' : ''}`}>
            {thisWeek.count} <span className="faint" style={{ fontSize: 13 }}>/ {target}</span>
          </div>
          <div className="lbl">SESSIONS THIS WEEK</div>
        </div>
        <div className="stat">
          <div className="num">{thisWeek.minutes ?? '—'}</div>
          <div className="lbl">MINUTES THIS WEEK</div>
        </div>
      </div>

      <h2 className="section">LAST 8 WEEKS · SESSIONS</h2>
      <div className="panel">
        <div className="bars" role="img" aria-label="weekly boxing sessions">
          {weeks.map((w, i) => (
            <div key={w.weekStart} className={`bar ${w.count >= target ? 'target' : ''} ${i === weeks.length - 1 ? 'current' : ''}`}>
              <b>{w.count}</b>
              <i style={{ height: `${(w.count / maxCount) * 100}%` }} />
              <small>{formatShort(w.weekStart).replace(' ', '')}</small>
            </div>
          ))}
        </div>
        <div className="faint tiny mt8">target {target} / week · minimum {bg?.minimum ?? 2}</div>
      </div>

      {anyMeta && (
        <>
          <h2 className="section">WEEKLY DETAIL</h2>
          {[...weeks].reverse().map((w) => (
            <div key={w.weekStart} className="week-row">
              <span className="faint">{formatWeekRange(w.weekStart)}</span>
              <span className="dim">
                {w.count} sess{w.minutes != null ? ` · ${w.minutes} min` : ''}
                {w.load != null ? ` · load ${w.load}` : ''}
              </span>
              <span className="faint">
                {Object.entries(w.types)
                  .map(([t, n]) => `${boxingTypeLabel(t as never)}${n > 1 ? `×${n}` : ''}`)
                  .join(' ')}
              </span>
            </div>
          ))}
          <div className="faint tiny mt8">Load = minutes × RPE. Rough telemetry only: sparring and bag work are not interchangeable.</div>
          {typeTotals.length > 0 && (
            <div className="chip-row mt8">
              {typeTotals.map((t) => (
                <span key={t.id} className="chip">{t.label} {t.n}</span>
              ))}
            </div>
          )}
        </>
      )}

      <h2 className="section">RECENT SESSIONS</h2>
      {recent.length === 0 && <div className="panel center dim small">No boxing logged yet.</div>}
      {recent.map((b) => (
        <button key={b.id} className="list-row" onClick={() => setDetailsFor(b.id)}>
          <span className="dim small" style={{ width: 64 }}>{formatShort(b.date)}</span>
          <span style={{ flex: 1 }}>
            {b.sessionType ? boxingTypeLabel(b.sessionType) : 'BOXING'}
            <span className="faint tiny">
              {b.durationMin ? ` · ${b.durationMin} MIN` : ''}
              {b.rpe ? ` · RPE ${b.rpe}` : ''}
              {boxingLoad(b) != null ? ` · LOAD ${boxingLoad(b)}` : ''}
            </span>
          </span>
          <span className="green">✓</span>
        </button>
      ))}
      {detailsRec && <BoxingDetailsSheet record={detailsRec} title="BOXING DETAILS" onClose={() => setDetailsFor(null)} />}
    </>
  );
}

// ── HISTORY ───────────────────────────────────────────────────────────────

function LogView() {
  const state = useAppState();
  const [open, setOpen] = useState<string | null>(null);
  const completed = [...state.sessions].filter((s) => s.status === 'completed').sort((a, b) => b.startedAt - a.startedAt);
  const boxing = [...state.boxing].sort((a, b) => (a.date < b.date ? 1 : -1));
  const merged: { kind: 'workout' | 'boxing'; date: string; id: string }[] = [
    ...completed.map((s) => ({ kind: 'workout' as const, date: s.date, id: s.id })),
    ...boxing.map((b) => ({ kind: 'boxing' as const, date: b.date, id: b.id })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const openSession = open ? completed.find((s) => s.id === open) : null;

  return (
    <>
      {merged.length === 0 && <div className="panel mt16 center dim small">No history yet.</div>}
      {merged.slice(0, 60).map((item) =>
        item.kind === 'boxing' ? (
          <div key={item.id} className="list-row">
            <span className="dim small" style={{ width: 64 }}>{formatShort(item.date)}</span>
            <span style={{ flex: 1 }}>
              BOXING
              <span className="faint tiny">{boxing.find((b) => b.id === item.id)?.sessionType ? ` · ${boxing.find((b) => b.id === item.id)?.sessionType?.toUpperCase()}` : ''}</span>
            </span>
            <span className="green">✓</span>
          </div>
        ) : (
          <button key={item.id} className="list-row" onClick={() => setOpen(item.id)}>
            <span className="dim small" style={{ width: 64 }}>{formatShort(item.date)}</span>
            <span style={{ flex: 1 }}>{completed.find((s) => s.id === item.id)?.name}</span>
            <span className="green">✓</span>
          </button>
        ),
      )}
      {openSession && (
        <Sheet onClose={() => setOpen(null)}>
          <div className="tiny faint">{formatShort(openSession.date)}</div>
          <div style={{ fontSize: 18, fontWeight: 800 }}>{openSession.name}</div>
          {openSession.finishedAt && (
            <div className="tiny faint">{formatDuration(openSession.finishedAt - openSession.startedAt)}</div>
          )}
          <div style={{ maxHeight: '55dvh', overflowY: 'auto', marginTop: 8 }}>
            {openSession.exercises
              .filter((es) => es.sets.some((x) => x.reps != null))
              .map((es) => {
                const lbl = resultLabel(es.result);
                return (
                  <div key={es.id} className="spread mt8">
                    <span className="small">
                      {es.name}
                      {es.substitutedFor && <span className="purple tiny"> · sub</span>}
                    </span>
                    <span className="small dim">
                      {fmtWeightShort(es)} × {es.sets.filter((x) => x.reps != null).map((x) => x.reps).join(', ')}
                      {lbl.text && <span className={lbl.cls}> {lbl.glyph}</span>}
                      {isIncrease(es.result) ? '' : ''}
                    </span>
                  </div>
                );
              })}
          </div>
          <div className="faint tiny mt16">Edit or delete via CALENDAR → tap the day.</div>
        </Sheet>
      )}
    </>
  );
}
