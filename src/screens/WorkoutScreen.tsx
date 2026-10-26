import { useEffect, useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import type { ExerciseSession, WorkoutSession } from '../types';
import { RepPicker } from '../components/RepPicker';
import { WeightEditor } from '../components/WeightEditor';
import { ExercisePicker } from '../components/ExercisePicker';
import { Confirm, Sheet } from '../components/Sheet';
import { fmtRange, fmtRepList, fmtReps, trimNum } from '../lib/format';
import { isComplete, lastPerformance, resultLabel } from '../lib/progression';
import { adjacentVariation, basisText, chainResultText } from '../lib/variation';
import { chainFor, progressionById } from '../data/progressions';
import { fmtTargets, hitAllTargets } from '../lib/prescribe';
import { fmtRest } from '../lib/pairs';
import { detectStall } from '../lib/stall';
import { beepTimerDone, beepTick, vibrate } from '../lib/sound';
import { formatDuration, formatShort } from '../lib/dates';

function exDone(es: ExerciseSession): boolean {
  return es.sets.filter((s) => s.reps != null).length >= es.targetSets;
}

function loggedCountOf(es: ExerciseSession): number {
  return es.sets.filter((s) => s.reps != null).length;
}

/**
 * Antagonist pairing: after a set on one exercise of a pair group, the partner with the fewest
 * logged sets (that is not finished) is next. Falls back to the current exercise when the partner is done.
 */
function nextInPair(session: WorkoutSession, idx: number): number | null {
  const cur = session.exercises[idx];
  if (!cur.pairGroup) return null;
  const members = session.exercises
    .map((e, i) => ({ e, i }))
    .filter(({ e, i }) => e.pairGroup === cur.pairGroup && i !== idx && !exDone(e));
  if (members.length === 0) return null;
  const mine = loggedCountOf(cur);
  members.sort((a, b) => {
    const da = loggedCountOf(a.e) - mine;
    const db = loggedCountOf(b.e) - mine;
    if (da !== db) return da - db;
    const oa = (a.i - idx + session.exercises.length) % session.exercises.length;
    const ob = (b.i - idx + session.exercises.length) % session.exercises.length;
    return oa - ob;
  });
  return loggedCountOf(members[0].e) <= mine ? members[0].i : null;
}

export function WorkoutScreen({ sessionId, onExit }: { sessionId: string; onExit: () => void }) {
  const state = useAppState();
  const session = state.sessions.find((s) => s.id === sessionId);
  const [idx, setIdx] = useState(() => {
    const s = store.state.sessions.find((x) => x.id === sessionId);
    const first = s?.exercises.findIndex((e) => !exDone(e)) ?? 0;
    return first >= 0 ? first : 0;
  });
  const [picking, setPicking] = useState<number | null>(null); // set index
  const [editingWeight, setEditingWeight] = useState(false);
  const [substituting, setSubstituting] = useState(false);
  const [subChoice, setSubChoice] = useState<string | null>(null);
  const [confirmingFinish, setConfirmingFinish] = useState(false);
  const [confirmingAbort, setConfirmingAbort] = useState(false);
  const [finished, setFinished] = useState<WorkoutSession | null>(null);
  const [warmupOpen, setWarmupOpen] = useState<boolean | null>(null); // null = auto (open until the first set)
  const [chainOpen, setChainOpen] = useState(false);
  const [hold, setHold] = useState<{ setIdx: number; startedAt: number; totalSec: number; esId: string } | null>(null);
  const [holdNow, setHoldNow] = useState(Date.now());
  useEffect(() => {
    if (!hold) return;
    const iv = setInterval(() => setHoldNow(Date.now()), 200);
    return () => clearInterval(iv);
  }, [hold?.startedAt]);

  // a new exercise card always starts at the top (the pair flips you there mid-session)
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [idx]);

  const es = session?.exercises[idx];

  const last = useMemo(
    () => (es && session ? lastPerformance(state.sessions, es.exerciseId, session.startedAt) : null),
    [es?.exerciseId, state.sessions, session?.startedAt],
  );
  const chain = useMemo(() => (es?.progressionId ? chainFor(state.exercises, es.exerciseId) : []), [es?.exerciseId, es?.progressionId, state.exercises]);
  const progression = progressionById(es?.progressionId);
  const stall = useMemo(
    () => (es && session ? detectStall(state.sessions, es.exerciseId, es.weight, session.startedAt) : null),
    [es?.exerciseId, es?.weight, state.sessions, session?.startedAt],
  );
  const holdElapsed = hold ? Math.max(0, (holdNow - hold.startedAt) / 1000) : 0;
  const holdRemaining = hold ? Math.max(0, hold.totalSec - holdElapsed) : 0;
  useEffect(() => {
    if (!hold || holdRemaining > 0) return;
    const { soundOn, vibrateOn } = store.state.settings;
    if (soundOn) beepTimerDone();
    if (vibrateOn) vibrate([120, 80, 240]);
    const h = hold;
    setHold(null);
    logReps(h.setIdx, h.totalSec);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hold, holdRemaining <= 0]);

  if (!session || session.status !== 'active') {
    if (finished) return <CompletionOverlay session={finished} onDone={onExit} />;
    return (
      <div className="screen center">
        <div className="muted mt16">Session not found.</div>
        <button className="btn btn--ghost mt16" onClick={onExit}>Back</button>
      </div>
    );
  }
  if (!es) return null;

  const allDone = session.exercises.every(exDone);
  const anyLogged = session.exercises.some((e) => loggedCountOf(e) > 0);
  const loggedCount = loggedCountOf(es);
  const nextSetIdx = es.sets.findIndex((s) => s.reps == null);
  const partners = es.pairGroup ? session.exercises.filter((e) => e.pairGroup === es.pairGroup && e.id !== es.id) : [];
  const doneCount = session.exercises.filter(exDone).length;

  const showWarmup = !!session.warmup?.length && (warmupOpen ?? !anyLogged);
  const isChain = !!es.progressionId && chain.length > 0;
  const down = isChain ? adjacentVariation(state.exercises, es.exerciseId, -1) : null;
  const up = isChain ? adjacentVariation(state.exercises, es.exerciseId, 1) : null;
  const canShift = loggedCount === 0;
  const basis = isChain ? basisText(es) : null;

  function startHold(si: number, sec: number) {
    if (!es) return;
    store.clearRest();
    if (store.state.settings.soundOn) beepTick();
    setHoldNow(Date.now());
    setHold({ setIdx: si, startedAt: Date.now(), totalSec: sec, esId: es.id });
  }

  function stopHoldEarly() {
    if (!hold) return;
    const secs = Math.max(0, Math.floor(holdElapsed));
    const h = hold;
    setHold(null);
    logReps(h.setIdx, secs);
  }

  function logReps(si: number, reps: number) {
    if (!session || !es) return;
    const wasLogged = es.sets[si].reps != null;
    store.logSet(session.id, es.id, si, reps);
    setPicking(null);
    if (wasLogged) return; // editing an old set: no timer, no advance
    const fresh = store.state.sessions.find((s) => s.id === session.id);
    if (!fresh) return;
    const freshEs = fresh.exercises[idx];
    const everythingDone = fresh.exercises.every(exDone);
    if (!everythingDone) store.startRest(es.restSec);
    // antagonist pair: alternate to the partner after every set
    const pair = nextInPair(fresh, idx);
    if (pair != null) {
      setTimeout(() => setIdx(pair), 350);
      return;
    }
    if (exDone(freshEs) && freshEs.sets.every((s) => s.reps != null)) {
      const after = fresh.exercises.findIndex((e, i) => i > idx && !exDone(e));
      const anywhere = fresh.exercises.findIndex((e, i) => i !== idx && !exDone(e));
      const target = after >= 0 ? after : anywhere;
      if (target >= 0) setTimeout(() => setIdx(target), 350);
    }
  }

  function finish() {
    if (!session) return;
    const done = store.finishWorkout(session.id);
    setConfirmingFinish(false);
    if (done) setFinished(done);
  }

  const lastLabel = last ? (isChain ? chainResultText(last.es.result, last.es) : resultLabel(last.es.result)) : null;

  return (
    <div className="screen screen--flush">
      <div className="wk-header">
        <div className="spread">
          <div className="row">
            <button className="btn btn--ghost btn--tiny" disabled={idx === 0} onClick={() => setIdx(idx - 1)} aria-label="previous exercise">‹</button>
            <div>
              <div className="bold">{session.name}</div>
              <div className="faint tiny">Exercise {idx + 1} of {session.exercises.length} · {doneCount} done</div>
            </div>
            <button className="btn btn--ghost btn--tiny" disabled={idx === session.exercises.length - 1} onClick={() => setIdx(idx + 1)} aria-label="next exercise">›</button>
          </div>
          <button className="btn btn--ghost btn--small" onClick={() => setConfirmingAbort(true)}>
            Exit
          </button>
        </div>
        <div className="wk-progress" aria-hidden>
          {session.exercises.map((e, i) => (
            <span key={e.id} className={exDone(e) ? 'done' : i === idx ? 'current' : ''} />
          ))}
        </div>
      </div>

      {session.warmup?.length ? (
        <div className="warmup" data-testid="warmup">
          <button className="spread" style={{ width: '100%' }} onClick={() => setWarmupOpen(!showWarmup)} aria-expanded={showWarmup}>
            <span className="bold small">Warm-up · about 5 min</span>
            <span className="faint tiny">{showWarmup ? 'Hide' : 'Show'}</span>
          </button>
          {showWarmup && (
            <ul>
              {session.warmup.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <h2 className="ex-name">{es.name}</h2>
      {es.substitutedFor && <div className="accent tiny mt4">Swapped in for {es.substitutedFor}</div>}

      {/* ── chain position ── */}
      {isChain && (
        <div className="mt8" data-testid="chain">
          <button className="spread" style={{ width: '100%' }} onClick={() => setChainOpen(!chainOpen)} aria-expanded={chainOpen}>
            <span className="muted small">
              {progression?.name ?? 'Chain'} chain · rung {(es.level ?? 0) + 1} of {es.levelCount ?? chain.length}
            </span>
            <span className="link">{chainOpen ? 'Hide ladder' : 'Ladder'}</span>
          </button>
          <div className="ladder" aria-hidden>
            {chain.map((c, i) => (
              <span key={c.id} className={i < (es.level ?? 0) ? 'past' : i === (es.level ?? 0) ? 'now' : ''} />
            ))}
          </div>
          {basis && <div className={`tiny ${basis.cls} mt8`} data-testid="chain-basis">{basis.text}</div>}
          {chainOpen && (
            <div className="rung-list card mt8" style={{ padding: '4px 14px' }}>
              {chain.map((c, i) => (
                <div key={c.id} className={`rung ${i === es.level ? 'rung--now' : i < (es.level ?? 0) ? 'rung--past' : 'rung--future'}`} style={{ padding: '8px 0' }}>
                  <span className="rung__num">{i < (es.level ?? 0) ? '✓' : i + 1}</span>
                  <span className="rung__name small">{c.name}</span>
                </div>
              ))}
              {progression && <div className="faint tiny" style={{ padding: '8px 0 10px' }}>At the top: {progression.topNote}</div>}
            </div>
          )}
        </div>
      )}

      {es.cue && <div className="cue">{es.cue}</div>}
      {es.gear && <div className="faint tiny mt8">Needs: {es.gear}</div>}

      {partners.length > 0 && (
        <div className="muted small mt12" data-testid="pair-note">
          ⇄ Paired with <b>{partners.map((p) => p.name).join(' and ')}</b>. One set here, rest {fmtRest(es.restSec)}, one set there, repeat.
        </div>
      )}

      {/* ── stall ── */}
      {stall && loggedCount === 0 && !es.deload && (
        <div className="banner banner--amber" data-testid="stall">
          <div className="banner__title">Stalled · {stall.sessions} sessions without progress</div>
          <div className="muted mt4">
            Total reps went {stall.from} → {stall.to}. Grinding the same numbers rarely works. Two ways out:
          </div>
          <div className="row mt8">
            <button className="btn btn--small grow" onClick={() => store.setDeload(session.id, es.id, true)}>
              Deload today
            </button>
            {down && (
              <button className="btn btn--small grow" onClick={() => store.shiftVariation(session.id, es.id, -1)}>
                Easier rung
              </button>
            )}
          </div>
          <div className="faint tiny mt8">Deload: every set drops to the floor of the range today, then the climb restarts. Easier rung: do {down?.name ?? 'the previous variation'} for a block of volume and come back.</div>
        </div>
      )}
      {es.deload && (
        <div className="banner banner--accent" data-testid="deload">
          <div className="spread">
            <div className="banner__title">Deload session</div>
            {loggedCount === 0 && <button className="link" onClick={() => store.setDeload(session.id, es.id, false)}>Undo</button>}
          </div>
          <div className="muted mt4">Easy by design. Hit the floor targets, stop there, and the climb restarts next time.</div>
        </div>
      )}

      {/* ── targets + sets ── */}
      {es.targetReps?.length ? (
        <div className="target-line" data-testid="targets">
          <span className="eyebrow">{es.timed ? 'Hold' : 'Reps'}</span>
          <span className="target-line__nums">{fmtTargets(es.targetReps, es.timed)}</span>
          <span className="faint small">{es.perSide ? 'each side · ' : ''}range {fmtRange(es.repMin, es.repMax, es.timed)}</span>
        </div>
      ) : null}

      <div role="list" aria-label="sets">
        {es.sets.map((set, i) => {
          const stateCls = set.reps != null ? 'set-row--done' : i === nextSetIdx ? 'set-row--next' : 'set-row--pending';
          const goal = es.targetReps?.[i];
          const hit = set.reps != null && goal != null && set.reps >= goal;
          return (
            <div key={i} className={`set-row ${stateCls}`} role="listitem">
              <button className="set-row__main" onClick={() => setPicking(i)} aria-label={`set ${i + 1}${goal != null ? `, target ${goal}` : ''}`}>
                <span className="set-row__label">
                  Set {i + 1}{i >= es.targetSets ? '+' : ''}
                </span>
                <span className={`set-row__value ${set.reps != null ? (hit ? 'green' : goal != null ? 'amber' : '') : i === nextSetIdx ? '' : 'faint'}`}>
                  {set.reps != null ? fmtReps(set.reps, es.timed) : goal != null ? fmtReps(goal, es.timed) : '—'}
                </span>
                <span className="set-row__note">
                  {set.reps != null
                    ? `${goal != null ? `target ${fmtReps(goal, es.timed)}` : ''}${set.weight > 0 ? ` · +${trimNum(set.weight)} lb` : ''}`
                    : i === nextSetIdx
                      ? 'tap for a different number'
                      : ''}
                </span>
              </button>
              {set.reps == null && goal != null && i === nextSetIdx && !hold && (
                es.timed ? (
                  <button className="set-hit set-hit--hold" onClick={() => startHold(i, goal)} aria-label={`start hold ${goal} seconds`}>
                    ▶ {goal}s
                  </button>
                ) : (
                  <button className="set-hit" onClick={() => logReps(i, goal)} aria-label={`hit ${goal}`}>
                    ✓
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>
      {hold && hold.esId === es.id && (
        <div className="hold" data-testid="hold">
          <div className="eyebrow">Set {hold.setIdx + 1} · hold {hold.totalSec}s</div>
          <div className="hold__clock">{Math.ceil(holdRemaining)}</div>
          <div className="rest-track" aria-hidden>
            <i style={{ width: `${Math.min(100, (holdElapsed / hold.totalSec) * 100)}%` }} />
          </div>
          <button className="btn btn--ghost btn--small btn--block mt12" onClick={stopHoldEarly}>
            Stop early · log {Math.floor(holdElapsed)}s
          </button>
        </div>
      )}

      {last ? (
        <div className="muted small mt12">
          Last time · {formatShort(last.session.date)} · {fmtRepList(last.es.sets.map((s) => s.reps), last.es.timed)}
          {last.es.weight > 0 ? ` at +${trimNum(last.es.weight)} lb` : ''}
          {lastLabel && lastLabel.text && <span className={lastLabel.cls}> · {lastLabel.text.toLowerCase()}</span>}
        </div>
      ) : es.fromName ? (
        <div className="muted small mt12">First time on this rung. Last time you did {es.fromName}. If a set falls short, finish it on {es.fromName} and log what you got here.</div>
      ) : (
        <div className="muted small mt12">First time · no previous data</div>
      )}

      {/* ── load ── */}
      <button className="row mt12" onClick={() => setEditingWeight(true)} aria-label="edit added load">
        <span className="muted small">{es.weight > 0 ? `Added load +${trimNum(es.weight)} ${state.settings.units}` : 'Bodyweight'}</span>
        <span className="link">{es.weight > 0 ? 'Change' : '+ add load'}</span>
        {es.variationBasis === 'top' && es.weight === es.suggestedWeight && es.weight > 0 && <span className="pill pill--green">load up</span>}
      </button>

      <div className="row mt16">
        {isChain && (
          <>
            <button className="btn btn--ghost btn--small grow" disabled={!down || !canShift} onClick={() => store.shiftVariation(session.id, es.id, -1)} title={down?.name}>
              ↓ Easier
            </button>
            <button className="btn btn--ghost btn--small grow" disabled={!up || !canShift} onClick={() => store.shiftVariation(session.id, es.id, 1)} title={up?.name}>
              ↑ Harder
            </button>
          </>
        )}
        <button className="btn btn--ghost btn--small grow" onClick={() => store.addSet(session.id, es.id)}>
          + Set
        </button>
        {es.sets.length > es.targetSets && (
          <button className="btn btn--ghost btn--small" onClick={() => store.removeLastSet(session.id, es.id)}>
            − Set
          </button>
        )}
        <button className="btn btn--ghost btn--small grow" onClick={() => setSubstituting(true)}>
          Swap
        </button>
      </div>
      {isChain && !canShift && <div className="faint tiny mt8">Easier / harder changes the exercise, so it is only available before the first set.</div>}
      {es.sets.length > es.targetSets && (
        <div className="faint tiny mt8">Extra sets are bonus volume. Only the {es.targetSets} prescribed sets decide whether the chain advances.</div>
      )}

      {allDone ? (
        <button className="btn btn--green btn--block mt24" onClick={finish}>
          Complete workout ✓
        </button>
      ) : (
        <button className="btn btn--ghost btn--block mt24" onClick={() => setConfirmingFinish(true)}>
          Finish early…
        </button>
      )}
      <div style={{ height: 80 }} />

      {picking != null && (
        <RepPicker
          exerciseName={es.name}
          setNumber={picking + 1}
          repMin={es.repMin}
          repMax={es.repMax}
          timed={es.timed}
          target={es.targetReps?.[picking]}
          current={es.sets[picking]?.reps ?? null}
          onPick={(r) => logReps(picking, r)}
          onClose={() => setPicking(null)}
        />
      )}

      {editingWeight && (
        <WeightEditor
          name={es.name}
          weight={es.weight}
          increment={es.increment}
          suggested={es.suggestedWeight}
          unit={state.settings.units}
          onSave={(w) => {
            store.setExerciseWeight(session.id, es.id, w);
            setEditingWeight(false);
          }}
          onClose={() => setEditingWeight(false)}
        />
      )}

      {substituting && (
        <ExercisePicker
          title={`Swap ${es.name}`}
          forExerciseId={es.exerciseId}
          onPick={(ex) => {
            setSubstituting(false);
            setSubChoice(ex.id);
          }}
          onClose={() => setSubstituting(false)}
        />
      )}

      {subChoice && (
        <Sheet onClose={() => setSubChoice(null)} title={store.exerciseById(subChoice)?.name}>
          <p className="muted small" style={{ margin: '8px 0 0' }}>
            Progression follows the exercise: the swap starts from its own history{store.exerciseById(subChoice)?.progressionId ? ', and its chain picks up from whatever you actually do' : ''}.
          </p>
          <button
            className="btn btn--block mt16"
            onClick={() => {
              store.substituteExercise(session.id, es.id, subChoice, false);
              setSubChoice(null);
            }}
          >
            Just today
          </button>
          <button
            className="btn btn--block mt8"
            onClick={() => {
              store.substituteExercise(session.id, es.id, subChoice, true);
              setSubChoice(null);
            }}
          >
            Replace in the program
          </button>
        </Sheet>
      )}

      {confirmingFinish && (
        <Confirm
          title="Finish with unlogged sets?"
          body="Logged sets are kept. Exercises without all prescribed sets are marked incomplete and keep their rung. Finishing early never triggers a step back."
          confirmLabel="Finish"
          onConfirm={finish}
          onCancel={() => setConfirmingFinish(false)}
        />
      )}

      {confirmingAbort && (
        <Sheet onClose={() => setConfirmingAbort(false)} title="Leave workout">
          <button className="btn btn--block mt16" onClick={onExit}>
            Keep it open, resume later
          </button>
          <button
            className="btn btn--danger btn--block mt8"
            onClick={() => {
              store.abortWorkout(session.id);
              onExit();
            }}
          >
            Discard this workout
          </button>
          {loggedCount > 0 && <div className="center faint tiny mt8">Discarding deletes {loggedCount} logged set(s) from today.</div>}
        </Sheet>
      )}

      {finished && <CompletionOverlay session={finished} onDone={onExit} />}
    </div>
  );
}

function CompletionOverlay({ session, onDone }: { session: WorkoutSession; onDone: () => void }) {
  const state = useAppState();
  const performed = session.exercises.filter((es) => es.sets.some((s) => s.reps != null));
  const advanced = performed.filter((es) => es.result === 'increase' && es.progressionId && es.level != null && es.levelCount != null && es.level < es.levelCount - 1);
  const held = performed.filter((es) => es.result === 'hold' || es.result === 'keep');
  const totalSets = performed.reduce((n, es) => n + es.sets.filter((s) => s.reps != null).length, 0);
  const duration = session.finishedAt ? session.finishedAt - session.startedAt : 0;
  return (
    <div className="complete-overlay">
      <div className="complete-card">
        <div className="eyebrow">Session complete</div>
        <h1 className="title">{session.name} ✓</h1>
        <div className="muted small">
          {totalSets} sets{duration > 60000 ? ` · ${formatDuration(duration)}` : ''}
          {advanced.length > 0 && <span className="green"> · {advanced.length} chain{advanced.length > 1 ? 's' : ''} advanced</span>}
        </div>
        <div className="hr" />
        {performed.map((es) => {
          const isChain = !!es.progressionId;
          const lbl = isChain ? chainResultText(es.result, es) : { ...resultLabel(es.result), detail: '' };
          const complete = isComplete(es);
          const next = isChain && es.result === 'increase' ? adjacentVariation(state.exercises, es.exerciseId, 1) : null;
          const prev = isChain && es.result === 'reduce' ? adjacentVariation(state.exercises, es.exerciseId, -1) : null;
          return (
            <div key={es.id} className="spread" style={{ padding: '10px 0', borderBottom: '1px solid var(--line)' }}>
              <div className="grow">
                <div className="bold small">{es.name}</div>
                <div className="faint tiny">
                  {fmtRepList(es.sets.map((s) => s.reps), es.timed)}
                  {es.weight > 0 ? ` at +${trimNum(es.weight)} lb` : ''}
                  {es.targetReps?.length ? (hitAllTargets(es) ? <span className="green"> · all targets hit</span> : ` · target ${fmtTargets(es.targetReps, es.timed)}`) : ''}
                </div>
              </div>
              <div className={`${lbl.cls} small`} style={{ textAlign: 'right' }}>
                <div className="bold">{lbl.glyph} {lbl.text}</div>
                <div className="tiny faint">
                  {isChain ? (
                    <>
                      {es.result === 'increase' && next && <>next: {next.name}</>}
                      {es.result === 'increase' && !next && <>top of chain · add load</>}
                      {es.result === 'reduce' && prev && <>try: {prev.name}</>}
                      {!es.deload && (es.result === 'hold' || es.result === 'keep') && <>same rung · +1 next time</>}
                      {es.deload && <>restart just above the floor</>}
                      {es.result === 'incomplete' && complete === false && <>no decision</>}
                    </>
                  ) : (
                    <>
                      {es.result === 'increase' && <>next: +{trimNum(es.weight + es.increment)} lb</>}
                      {es.result === 'reduce' && <>try: +{trimNum(Math.max(0, es.weight - es.increment))} lb</>}
                      {(es.result === 'hold' || es.result === 'keep') && <>same load · +1 next time</>}
                      {es.result === 'incomplete' && complete === false && <>no decision</>}
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {held.length > 0 && advanced.length === 0 && <div className="muted small mt16">Holding a rung is normal. Each session adds a rep until the ceiling falls.</div>}
        <button className="btn btn--green btn--block mt24" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}
