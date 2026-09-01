import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import { LineChart } from '../components/LineChart';
import { bestSet, exerciseHistory, movingAverage } from '../lib/progression';
import { fmtWeightShort, trimNum } from '../lib/format';
import { formatDuration, formatShort, todayISO } from '../lib/dates';
import { Confirm, Sheet } from '../components/Sheet';

type SubView = 'lifts' | 'body' | 'log';

export function ProgressScreen() {
  const [view, setView] = useState<SubView>('lifts');
  return (
    <div className="screen">
      <div className="topline">TELEMETRY</div>
      <h1 className="title">PROGRESS</h1>
      <div className="chip-row mt8">
        {(['lifts', 'body', 'log'] as const).map((v) => (
          <button key={v} className={`chip ${view === v ? 'on' : ''}`} onClick={() => setView(v)}>
            {v === 'lifts' ? 'LIFTS' : v === 'body' ? 'BODY' : 'HISTORY'}
          </button>
        ))}
      </div>
      {view === 'lifts' && <LiftsView />}
      {view === 'body' && <BodyView />}
      {view === 'log' && <LogView />}
    </div>
  );
}

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
  const volumePts = history.map((h) => ({ date: h.date, value: h.volume }));

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
          <div className="lbl">CURRENT</div>
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

      <h2 className="section">WEIGHT OVER TIME</h2>
      <LineChart series={[{ points: weightPts, color: 'var(--cyan)', dots: true }]} unit="lb" />

      <h2 className="section">VOLUME PER SESSION</h2>
      <LineChart series={[{ points: volumePts, color: 'var(--purple)', dots: true }]} unit="lb·reps" />

      <h2 className="section">RECENT SESSIONS</h2>
      {[...history].reverse().slice(0, 10).map((h, i) => (
        <div key={i} className="spread panel mt8" style={{ padding: '10px 14px' }}>
          <span className="dim small">{formatShort(h.date)}</span>
          <span className="small">
            {fmtWeightShort({ weight: h.weight, bodyweight: ex?.bodyweight })} × {h.reps.join(', ')}
          </span>
          <span className={h.result === 'progress' ? 'green' : 'faint'}>{h.result === 'progress' ? '▲' : '·'}</span>
        </div>
      ))}
    </>
  );
}

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
  const latestMA = ma[ma.length - 1];
  const monthAgoMA = ma.filter((p) => p.date <= addDaysStr(todayISO(), -28)).pop();

  function save() {
    const w = Number(weight);
    if (!w || w <= 0) return;
    store.addMeasurement(date, w, waist ? Number(waist) : undefined);
    setWeight('');
    setWaist('');
    setDate(todayISO());
  }

  return (
    <>
      <div className="panel mt16">
        <div className="tiny faint">LOG BODY WEIGHT</div>
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
          <button className="btn btn--primary" style={{ minHeight: 48, flex: 1 }} disabled={!weight} onClick={save}>
            SAVE
          </button>
        </div>
      </div>

      {sorted.length > 0 && (
        <>
          <div className="stat-grid">
            <div className="stat">
              <div className="num">{latest.weightLb}</div>
              <div className="lbl">LATEST (LB)</div>
            </div>
            <div className="stat">
              <div className="num">{latestMA ? latestMA.value : '—'}</div>
              <div className="lbl">{state.settings.maWindowDays}D AVG</div>
            </div>
            <div className="stat">
              <div className="num">
                {latestMA && monthAgoMA
                  ? (latestMA.value - monthAgoMA.value <= 0 ? '' : '+') + trimNum(Math.round((latestMA.value - monthAgoMA.value) * 10) / 10)
                  : '—'}
              </div>
              <div className="lbl">4W TREND</div>
            </div>
          </div>

          <h2 className="section">WEIGHT · RAW + {state.settings.maWindowDays}D AVERAGE</h2>
          <LineChart
            series={[
              { points: raw, color: 'var(--faint)', dots: true, dashed: true },
              { points: ma, color: 'var(--cyan)' },
            ]}
            unit="lb"
          />

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

function addDaysStr(iso: string, n: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

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
            <span style={{ flex: 1 }}>BOXING</span>
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
              .map((es) => (
                <div key={es.id} className="spread mt8">
                  <span className="small">{es.name}</span>
                  <span className="small dim">
                    {fmtWeightShort(es)} × {es.sets.filter((x) => x.reps != null).map((x) => x.reps).join(', ')}
                    {es.result === 'progress' && <span className="green"> ▲</span>}
                  </span>
                </div>
              ))}
          </div>
          <div className="faint tiny mt16">Edit or delete via CALENDAR → tap the day.</div>
        </Sheet>
      )}
    </>
  );
}
