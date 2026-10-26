import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import { addDays, formatLong, formatShort, MONTH_NAMES, parseISO, todayISO, toISODate, WEEKDAY_SHORT, weekdayIndex } from '../lib/dates';
import { Confirm, Sheet } from '../components/Sheet';
import { LineChart } from '../components/LineChart';
import { fmtRepList, trimNum } from '../lib/format';
import { chainResultText } from '../lib/variation';
import { resultLabel } from '../lib/progression';
import { movingAverage, waistTrend, weightTrend, fmtDelta } from '../lib/body';
import { optionalTemplateIds } from '../lib/flex';
import type { WorkoutSession } from '../types';

function monthGrid(anchor: string): { cells: { date: string; inMonth: boolean }[]; label: string } {
  const d = parseISO(anchor);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const firstISO = toISODate(first);
  const lead = weekdayIndex(firstISO);
  const start = addDays(firstISO, -lead);
  const cells = Array.from({ length: 42 }, (_, i) => {
    const date = addDays(start, i);
    return { date, inMonth: parseISO(date).getMonth() === d.getMonth() };
  });
  const label = `${MONTH_NAMES[d.getMonth()].charAt(0)}${MONTH_NAMES[d.getMonth()].slice(1).toLowerCase()} ${d.getFullYear()}`;
  return { cells: cells.slice(0, cells[35].inMonth ? 42 : 35), label };
}

export function HistoryScreen() {
  const state = useAppState();
  const today = todayISO();
  const [anchor, setAnchor] = useState(today);
  const [selected, setSelected] = useState<string | null>(null);
  const plan = store.activePlan();
  const optional = plan ? optionalTemplateIds(plan) : [];
  const { cells, label } = useMemo(() => monthGrid(anchor), [anchor]);

  const byDate = useMemo(() => {
    const m = new Map<string, WorkoutSession[]>();
    for (const s of state.sessions) {
      if (s.status !== 'completed') continue;
      const arr = m.get(s.date) ?? [];
      arr.push(s);
      m.set(s.date, arr);
    }
    return m;
  }, [state.sessions]);

  const monthCount = cells.filter((c) => c.inMonth && byDate.has(c.date)).length;
  const shift = (n: number) => {
    const d = parseISO(anchor);
    setAnchor(toISODate(new Date(d.getFullYear(), d.getMonth() + n, 1)));
  };

  return (
    <div className="screen">
      <div className="eyebrow">History</div>
      <h1 className="title">Training record</h1>

      <div className="card mt16">
        <div className="spread">
          <button className="btn btn--ghost btn--tiny" onClick={() => shift(-1)} aria-label="previous month">‹</button>
          <div className="bold">{label}</div>
          <button className="btn btn--ghost btn--tiny" onClick={() => shift(1)} aria-label="next month">›</button>
        </div>
        <div className="cal-grid">
          {WEEKDAY_SHORT.map((w) => (
            <div key={w} className="cal-head">{w.charAt(0)}{w.slice(1).toLowerCase()}</div>
          ))}
          {cells.map((c) => {
            const sessions = byDate.get(c.date) ?? [];
            const done = sessions.length > 0;
            return (
              <button
                key={c.date}
                className={`cal-cell ${c.inMonth ? '' : 'cal-cell--out'} ${c.date === today ? 'cal-cell--today' : ''} ${selected === c.date ? 'cal-cell--sel' : ''} ${done ? 'cal-cell--done' : ''}`}
                onClick={() => setSelected(c.date)}
                aria-label={`${c.date}${done ? `, ${sessions.map((s) => s.name).join(', ')}` : ''}`}
              >
                <span>{parseISO(c.date).getDate()}</span>
                <span className="row" style={{ gap: 2, minHeight: 6 }}>
                  {sessions.map((s) => (
                    <i key={s.id} className={s.templateId && optional.includes(s.templateId) ? 'opt' : ''} />
                  ))}
                </span>
              </button>
            );
          })}
        </div>
        <div className="faint tiny mt8">{monthCount} training day{monthCount === 1 ? '' : 's'} this month · tap a day for details</div>
      </div>

      <BodySection />

      {selected && <DaySheet date={selected} sessions={byDate.get(selected) ?? []} onClose={() => setSelected(null)} />}
    </div>
  );
}

function DaySheet({ date, sessions, onClose }: { date: string; sessions: WorkoutSession[]; onClose: () => void }) {
  const [deleting, setDeleting] = useState<string | null>(null);
  return (
    <Sheet onClose={onClose} title={formatLong(date)}>
      {sessions.length === 0 && <p className="muted small">No training logged. Rest days are part of the plan.</p>}
      {sessions.map((s) => (
        <div key={s.id} className="mt12">
          <div className="spread">
            <div className="bold">{s.name}</div>
            <button className="link red" onClick={() => setDeleting(s.id)}>Delete</button>
          </div>
          {s.exercises
            .filter((es) => es.sets.some((x) => x.reps != null))
            .map((es) => {
              const lbl = es.progressionId ? chainResultText(es.result, es) : resultLabel(es.result);
              return (
                <div key={es.id} className="spread" style={{ padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                  <div className="grow">
                    <div className="small">{es.name}</div>
                    <div className="faint tiny">
                      {fmtRepList(es.sets.map((x) => x.reps), es.timed)}
                      {es.weight > 0 ? ` at +${trimNum(es.weight)} lb` : ''}
                      {es.perSide ? ' · per side' : ''}
                    </div>
                  </div>
                  <span className={`tiny ${lbl.cls}`}>{lbl.glyph} {lbl.text}</span>
                </div>
              );
            })}
        </div>
      ))}
      {deleting && (
        <Confirm
          title="Delete this session?"
          body="It disappears from history and from every chain's progression. There is no undo."
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            store.deleteSession(deleting);
            setDeleting(null);
            onClose();
          }}
          onCancel={() => setDeleting(null)}
        />
      )}
    </Sheet>
  );
}

function BodySection() {
  const state = useAppState();
  const today = todayISO();
  const [logging, setLogging] = useState(false);
  const [w, setW] = useState('');
  const [waist, setWaist] = useState('');
  const trend = useMemo(() => weightTrend(state.measurements, state.settings.maWindowDays), [state.measurements, state.settings.maWindowDays]);
  const waistT = useMemo(() => waistTrend(state.measurements), [state.measurements]);
  const raw = useMemo(() => state.measurements.map((m) => ({ date: m.date, value: m.weightLb })).sort((a, b) => (a.date < b.date ? -1 : 1)), [state.measurements]);
  const ma = useMemo(() => movingAverage(raw, state.settings.maWindowDays), [raw, state.settings.maWindowDays]);
  const todayRec = state.measurements.find((m) => m.date === today);

  function save() {
    const weight = Number(w);
    if (!weight || weight <= 0) return;
    const wi = waist.trim() ? Number(waist) : undefined;
    store.addMeasurement(today, weight, wi && wi > 0 ? wi : undefined);
    setLogging(false);
    setW('');
    setWaist('');
  }

  return (
    <>
      <h2 className="section">Body</h2>
      <div className="card">
        <div className="spread">
          <div>
            <div className="bold">{trend ? `${trend.avg} lb` : 'No weigh-ins yet'}</div>
            <div className="faint tiny">
              {trend
                ? `${state.settings.maWindowDays}-day average · ${fmtDelta(trend.change7, 'lb')} vs last week · ${trend.lbPerWeek != null ? `${fmtDelta(trend.lbPerWeek)} lb/wk trend` : 'trend needs a week of data'}`
                : 'Weigh in a few mornings a week. The app shows the average, not the noise.'}
            </div>
            {waistT && <div className="faint tiny mt4">Waist {waistT.latest} in · {fmtDelta(waistT.change28, 'in')} over 4 weeks</div>}
          </div>
          <button className="btn btn--small" onClick={() => { setLogging(true); setW(todayRec ? String(todayRec.weightLb) : ''); setWaist(todayRec?.waistIn ? String(todayRec.waistIn) : ''); }}>
            {todayRec ? 'Edit today' : 'Weigh in'}
          </button>
        </div>
        {raw.length >= 2 && (
          <LineChart
            series={[
              { points: raw, color: 'var(--faint)', dots: true },
              { points: ma, color: 'var(--accent)' },
            ]}
            unit="lb"
          />
        )}
      </div>

      {logging && (
        <Sheet onClose={() => setLogging(false)} title={`Weigh-in · ${formatShort(today)}`}>
          <input className="mt12" type="number" inputMode="decimal" placeholder="Weight (lb)" value={w} onChange={(e) => setW(e.target.value)} autoFocus aria-label="weight in pounds" />
          <input className="mt8" type="number" inputMode="decimal" placeholder="Waist (in) · optional" value={waist} onChange={(e) => setWaist(e.target.value)} aria-label="waist in inches" />
          <div className="row mt16">
            {todayRec && (
              <button className="btn btn--ghost" onClick={() => { store.deleteMeasurement(todayRec.id); setLogging(false); }}>Remove</button>
            )}
            <button className="btn btn--primary grow" style={{ minHeight: 50 }} disabled={!w || Number(w) <= 0} onClick={save}>Save</button>
          </div>
        </Sheet>
      )}
    </>
  );
}
