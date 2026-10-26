import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import { PROGRESSIONS, chainLevels, progressionById } from '../data/progressions';
import type { Progression } from '../data/progressions';
import { lastChainPerformance, resolveVariation } from '../lib/variation';
import { exerciseHistory } from '../lib/progression';
import type { ExposureRow } from '../lib/progression';
import { detectStall } from '../lib/stall';
import { fmtRepList, trimNum } from '../lib/format';
import { formatShort } from '../lib/dates';
import type { Exercise, ExerciseSession, WorkoutSession } from '../types';

interface ChainStatus {
  p: Progression;
  rungs: Exercise[];
  /** rung the next session would serve (or the last one performed, for chains outside the program) */
  current: Exercise | null;
  level: number;
  inProgram: boolean;
  basis: ExerciseSession['variationBasis'] | null;
  last: { session: WorkoutSession; es: ExerciseSession } | null;
  stalled: boolean;
  exposures: number;
}

function useChainStatus(): ChainStatus[] {
  const state = useAppState();
  const plan = store.activePlan();
  return useMemo(() => {
    const tplIds = new Set(plan ? plan.weeklyGoals.flatMap((g) => (g.kind === 'rotation' ? g.templateIds : [g.templateId])) : []);
    const slots = state.templates.filter((t) => tplIds.has(t.id)).flatMap((t) => t.exercises);
    return PROGRESSIONS.map((p): ChainStatus => {
      const rungs = chainLevels(state.exercises, p.id);
      const ids = rungs.map((r) => r.id);
      const slot = slots.find((te) => ids.includes(te.exerciseId) && !te.lockVariation);
      const last = lastChainPerformance(state.sessions, ids);
      let current: Exercise | null = null;
      let basis: ChainStatus['basis'] = null;
      if (slot) {
        const choice = resolveVariation(state.sessions, state.exercises, slot);
        current = rungs.find((r) => r.id === choice?.exerciseId) ?? null;
        basis = choice?.basis ?? null;
      } else if (last) {
        current = rungs.find((r) => r.id === last.es.exerciseId) ?? null;
      }
      const level = current ? rungs.indexOf(current) : -1;
      const stalled = !!current && !!detectStall(state.sessions, current.id, last?.es.exerciseId === current.id ? last.es.weight : 0);
      const exposures = state.sessions.filter((s) => s.status === 'completed' && s.exercises.some((e) => ids.includes(e.exerciseId) && e.sets.some((x) => x.reps != null))).length;
      return { p, rungs, current, level, inProgram: !!slot, basis, last, stalled, exposures };
    });
  }, [state.exercises, state.sessions, state.templates, plan]);
}

export function ChainsScreen() {
  const chains = useChainStatus();
  const [open, setOpen] = useState<string | null>(null);
  const inProgram = chains.filter((c) => c.inProgram);
  const others = chains.filter((c) => !c.inProgram);
  const detail = open ? chains.find((c) => c.p.id === open) : null;

  if (detail) return <ChainDetail c={detail} onBack={() => setOpen(null)} />;

  return (
    <div className="screen">
      <div className="eyebrow">Progress</div>
      <h1 className="title">Chains</h1>
      <p className="muted small" style={{ margin: '4px 0 0' }}>Each chain is a ladder of harder variations. Hit the ceiling on every set and you climb a rung.</p>

      <h2 className="section">In your program</h2>
      {inProgram.map((c) => (
        <ChainCard key={c.p.id} c={c} onOpen={() => setOpen(c.p.id)} />
      ))}

      {others.length > 0 && (
        <>
          <h2 className="section">Other chains</h2>
          <p className="faint tiny" style={{ margin: '0 0 6px' }}>Not in the program right now. Swap one in during a session, or add it under Settings → Program.</p>
          {others.map((c) => (
            <ChainCard key={c.p.id} c={c} onOpen={() => setOpen(c.p.id)} />
          ))}
        </>
      )}
    </div>
  );
}

function ChainCard({ c, onOpen }: { c: ChainStatus; onOpen: () => void }) {
  const lastRow = c.last;
  return (
    <button className="chain-card" onClick={onOpen} data-testid={`chain-${c.p.id}`}>
      <div className="spread">
        <div className="grow">
          <div className="chain-card__name">{c.p.name}</div>
          <div className="chain-card__rung">
            {c.current ? `Rung ${c.level + 1} of ${c.rungs.length} · ${c.current.name}` : `${c.rungs.length} rungs · not started`}
          </div>
        </div>
        {c.stalled ? (
          <span className="pill pill--amber">stalled</span>
        ) : c.basis === 'advance' ? (
          <span className="pill pill--green">new rung next</span>
        ) : c.basis === 'top' ? (
          <span className="pill pill--green">top · add load</span>
        ) : c.basis === 'regress' ? (
          <span className="pill pill--amber">easier next</span>
        ) : null}
      </div>
      <div className="ladder" aria-hidden>
        {c.rungs.map((r, i) => (
          <span key={r.id} className={i < c.level ? 'past' : i === c.level ? 'now' : ''} />
        ))}
      </div>
      {lastRow && (
        <div className="faint tiny mt8">
          Last · {formatShort(lastRow.session.date)} · {lastRow.es.name} · {fmtRepList(lastRow.es.sets.map((s) => s.reps), lastRow.es.timed)}
          {lastRow.es.weight > 0 ? ` at +${trimNum(lastRow.es.weight)} lb` : ''}
        </div>
      )}
    </button>
  );
}

function ChainDetail({ c, onBack }: { c: ChainStatus; onBack: () => void }) {
  const state = useAppState();
  const histories = useMemo(() => {
    const m = new Map<string, ExposureRow[]>();
    for (const r of c.rungs) m.set(r.id, exerciseHistory(state.sessions, r.id));
    return m;
  }, [c.rungs, state.sessions]);
  const p = progressionById(c.p.id);

  return (
    <div className="screen">
      <button className="link" onClick={onBack}>‹ Chains</button>
      <div className="eyebrow mt12">{c.p.pattern}</div>
      <h1 className="title">{c.p.name} chain</h1>
      <div className="muted small">{c.p.muscles}</div>
      {c.p.needsClearance && <div className="amber tiny mt4">Needs a bar you can get above, not a doorway bar.</div>}

      <div className="card mt16 rung-list" style={{ paddingTop: 4, paddingBottom: 4 }}>
        {c.rungs.map((r, i) => {
          const h = histories.get(r.id) ?? [];
          const best = h.reduce<ExposureRow | null>((b, row) => {
            const tot = row.prescribedReps.reduce((a, x) => a + x, 0);
            const bt = b ? b.prescribedReps.reduce((a, x) => a + x, 0) : -1;
            return tot > bt ? row : b;
          }, null);
          const lastRow = h[h.length - 1];
          const cls = i < c.level ? 'rung--past' : i === c.level ? 'rung--now' : 'rung--future';
          return (
            <div key={r.id} className={`rung ${cls}`}>
              <span className="rung__num">{i < c.level ? '✓' : i + 1}</span>
              <div className="grow">
                <div className="rung__name">
                  {r.name}
                  {i === c.level && <span className="pill pill--accent" style={{ marginLeft: 8 }}>current</span>}
                  {r.timed && <span className="faint tiny"> · hold</span>}
                  {r.perSide && <span className="faint tiny"> · per side</span>}
                </div>
                {r.gear && <div className="rung__meta">Needs: {r.gear}</div>}
                {h.length > 0 && (
                  <div className="rung__meta">
                    {h.length} session{h.length > 1 ? 's' : ''}
                    {best ? ` · best ${fmtRepList(best.prescribedReps, r.timed)}${best.weight > 0 ? ` at +${trimNum(best.weight)} lb` : ''}` : ''}
                    {lastRow ? ` · last ${formatShort(lastRow.date)}` : ''}
                  </div>
                )}
                {i === c.level && r.cue && <div className="rung__meta" style={{ color: 'var(--muted)' }}>{r.cue}</div>}
              </div>
            </div>
          );
        })}
      </div>
      {p && <div className="muted small mt12">At the top of the chain: {p.topNote}</div>}

      {c.current && (histories.get(c.current.id)?.length ?? 0) > 0 && (
        <>
          <h2 className="section">Sessions on {c.current.name}</h2>
          <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
            {[...(histories.get(c.current.id) ?? [])].reverse().map((row, i) => (
              <div key={i} className="spread" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
                <span className="muted small">{formatShort(row.date)}</span>
                <span className="small bold">
                  {fmtRepList(row.prescribedReps, c.current?.timed)}
                  {row.weight > 0 ? <span className="faint"> +{trimNum(row.weight)}</span> : ''}
                </span>
                <span className={`tiny ${row.result === 'increase' ? 'green' : row.result === 'reduce' ? 'amber' : 'faint'}`}>
                  {row.deload ? 'deload' : row.result === 'increase' ? 'advanced' : row.result === 'reduce' ? 'step back' : row.result === 'incomplete' ? 'incomplete' : 'hold'}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
