import { useEffect, useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import type { ExerciseSession, WorkoutSession } from '../types';
import { RepPicker } from '../components/RepPicker';
import { WeightEditor } from '../components/WeightEditor';
import { ExercisePicker } from '../components/ExercisePicker';
import { Confirm, Sheet } from '../components/Sheet';
import { fmtRange, fmtRepList, fmtReps, fmtWeightShort, trimNum } from '../lib/format';
import { isComplete, lastPerformance, resultLabel, suggestWeight } from '../lib/progression';
import { adjacentVariation, basisText, chainResultText } from '../lib/variation';
import { chainFor, progressionById } from '../data/progressions';
import { fmtTargets, hitAllTargets } from '../lib/prescribe';
import { fmtRest, slotLabels } from '../lib/pairs';
import { beepTimerDone, beepTick, vibrate } from '../lib/sound';
import { formatDuration } from '../lib/dates';

function exDone(es: ExerciseSession): boolean {
  return es.sets.filter((s) => s.reps != null).length >= es.targetSets;
}

function loggedCountOf(es: ExerciseSession): number {
  return es.sets.filter((s) => s.reps != null).length;
}

function unitLabel(es: ExerciseSession, unit: string): string {
  if (es.bodyweight) return es.weight === 0 ? '' : `${unit.toUpperCase()} ADDED`;
  return `${unit.toUpperCase()}${es.perHand ? ' / HAND' : ''}`;
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
  // partners that are behind or level with us come first; then by order after the current slot
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
  const [rirFor, setRirFor] = useState<string | null>(null); // exercise-session id awaiting optional RIR
  const [finished, setFinished] = useState<WorkoutSession | null>(null);
  const [warmupOpen, setWarmupOpen] = useState<boolean | null>(null); // null = auto (open until the first set)
  const [chainOpen, setChainOpen] = useState(false);
  // hold countdown for timed sets: { setIdx, startedAt, totalSec }
  const [hold, setHold] = useState<{ setIdx: number; startedAt: number; totalSec: number; esId: string } | null>(null);
  const [holdNow, setHoldNow] = useState(Date.now());
  useEffect(() => {
    if (!hold) return;
    const iv = setInterval(() => setHoldNow(Date.now()), 200);
    return () => clearInterval(iv);
  }, [hold?.startedAt]);

  const es = session?.exercises[idx];

  const last = useMemo(
    () => (es && session ? lastPerformance(state.sessions, es.exerciseId, session.startedAt) : null),
    [es?.exerciseId, state.sessions, session?.startedAt],
  );
  const suggestion = useMemo(
    () => (es && session ? suggestWeight(state.sessions.filter((s) => s.id !== session.id && s.startedAt < session.startedAt), es.exerciseId, { increment: es.increment, startWeight: es.suggestedWeight }) : null),
    [es?.exerciseId, state.sessions, session?.id, session?.startedAt],
  );
  const chain = useMemo(() => (es?.progressionId ? chainFor(state.exercises, es.exerciseId) : []), [es?.exerciseId, es?.progressionId, state.exercises]);
  const progression = progressionById(es?.progressionId);
  const holdElapsed = hold ? Math.max(0, (holdNow - hold.startedAt) / 1000) : 0;
  const holdRemaining = hold ? Math.max(0, hold.totalSec - holdElapsed) : 0;
  // hold reached its target → beep, log the target automatically
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
        <div className="dim mt16">Session not found.</div>
        <button className="btn btn--ghost mt16" onClick={onExit}>BACK</button>
      </div>
    );
  }
  if (!es) return null;

  const allDone = session.exercises.every(exDone);
  const anyLogged = session.exercises.some((e) => loggedCountOf(e) > 0);
  const loggedCount = loggedCountOf(es);
  const nextSetIdx = es.sets.findIndex((s) => s.reps == null);
  const rirEs = rirFor ? session.exercises.find((e) => e.id === rirFor) : null;
  const partnerIdx = nextInPair(session, idx);
  const partners = es.pairGroup ? session.exercises.filter((e) => e.pairGroup === es.pairGroup && e.id !== es.id) : [];
  const labels = slotLabels(session.exercises);
  const label = labels[idx];
  const pairMembers = es.pairGroup ? session.exercises.map((e, i) => ({ e, i })).filter(({ e }) => e.pairGroup === es.pairGroup) : [];

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
    // optional one-tap RIR after the FINAL PRESCRIBED set only (off by default)
    if (state.settings.askRir && si === es.targetSets - 1 && freshEs.finalSetRir == null) setRirFor(es.id);
    // antagonist pair: alternate to the partner after every set
    const pair = nextInPair(fresh, idx);
    if (pair != null) {
      setTimeout(() => setIdx(pair), 350);
      return;
    }
    if (exDone(freshEs) && freshEs.sets.every((s) => s.reps != null)) {
      // auto-advance to the next incomplete exercise
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
          <div>
            <div className="tiny faint">ACTIVE SESSION</div>
            <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '0.1em' }}>{session.name}</div>
          </div>
          <button className="btn btn--ghost btn--small" onClick={() => setConfirmingAbort(true)}>
            EXIT
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
            <span className="tiny" style={{ letterSpacing: '0.16em', fontWeight: 700 }}>WARM-UP · ~5 MIN</span>
            <span className="tiny faint">{showWarmup ? 'HIDE' : 'SHOW'}</span>
          </button>
          {showWarmup && (
            <ul className="warmup__list">
              {session.warmup.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      <div className="ex-card">
        <div className="spread">
          <button
            className="btn btn--ghost btn--small"
            disabled={idx === 0}
            onClick={() => setIdx(idx - 1)}
            aria-label="previous exercise"
          >
            ‹
          </button>
          <div className="tiny dim">
            EXERCISE {idx + 1} / {session.exercises.length}
          </div>
          <button
            className="btn btn--ghost btn--small"
            disabled={idx === session.exercises.length - 1}
            onClick={() => setIdx(idx + 1)}
            aria-label="next exercise"
          >
            ›
          </button>
        </div>

        <div className="mt8">
          <span className={`slot-tag ${label.group ? 'slot-tag--pair' : ''}`}>{label.tag}</span>
          {label.group && <span className="tiny cyan">SUPERSET {label.group} · {label.pos + 1} OF {label.size}</span>}
        </div>
        <h3 className="ex-name" style={{ marginTop: 4 }}>{es.name.toUpperCase()}</h3>
        {es.substitutedFor && <div className="tiny purple">SUBSTITUTED FOR {es.substitutedFor.toUpperCase()}</div>}
        {es.targetReps?.length ? (
          <div className="target-line mt8" data-testid="targets">
            <span className="tiny faint">{es.timed ? 'HOLD' : 'REPS'}</span>
            <span className="target-line__nums">{fmtTargets(es.targetReps, es.timed)}</span>
            {es.perSide && <span className="tiny faint">EACH SIDE</span>}
          </div>
        ) : null}
        <div className="chips mt8" data-testid="how">
          <span className="chip-static">{es.targetSets} {es.timed ? 'HOLDS' : 'SETS'}</span>
          <span className="chip-static">{es.timed ? 'HOLD FOR SECONDS' : `${fmtRange(es.repMin, es.repMax)} REP RANGE`}</span>
          {es.perSide && <span className="chip-static chip-static--warn">PER SIDE · left then right = 1 set</span>}
          <span className="chip-static">REST {fmtRest(es.restSec)}{partners.length > 0 ? ' THEN SWITCH' : ''}</span>
          {es.targetRir != null && <span className="chip-static">LEAVE {es.targetRir} IN THE TANK</span>}
        </div>
        {partners.length > 0 && label.group && (
          <div className="superset mt8" data-testid="pair-note">
            <div className="superset__title">SUPERSET {label.group} · {pairMembers.map(({ e, i }) => `${labels[i].tag} ${e.name.toUpperCase()}`).join(' ⇄ ')}</div>
            <div className="tiny dim mt8">
              {pairMembers.map(({ i }) => labels[i].tag).join(' → ')} → rest {fmtRest(es.restSec)} → repeat until every set is done. The app flips to the partner after each set.
            </div>
          </div>
        )}

        {/* ── chain position ── */}
        {isChain && (
          <div className="chain" data-testid="chain">
            <button className="spread" style={{ width: '100%' }} onClick={() => setChainOpen(!chainOpen)} aria-expanded={chainOpen}>
              <span className="tiny" style={{ letterSpacing: '0.14em', fontWeight: 700 }}>
                {progression?.name ?? 'CHAIN'} · RUNG {(es.level ?? 0) + 1} / {es.levelCount ?? chain.length}
              </span>
              <span className="tiny faint">{chainOpen ? 'HIDE' : 'LADDER'}</span>
            </button>
            <div className="chain__ladder" aria-hidden>
              {chain.map((c, i) => (
                <span key={c.id} className={i < (es.level ?? 0) ? 'past' : i === (es.level ?? 0) ? 'now' : ''} />
              ))}
            </div>
            {basis && <div className={`tiny ${basis.cls} mt8`} data-testid="chain-basis">{basis.text}</div>}
            {chainOpen && (
              <div className="chain__list mt8">
                {chain.map((c, i) => (
                  <div key={c.id} className={`tiny ${i === es.level ? 'cyan' : i < (es.level ?? 0) ? 'dim' : 'faint'}`}>
                    {i === es.level ? '▸' : i < (es.level ?? 0) ? '✓' : '·'} {i + 1}. {c.name}
                  </div>
                ))}
                {progression && <div className="tiny faint mt8">TOP OF CHAIN → {progression.topNote}</div>}
              </div>
            )}
            <div className="row mt8" style={{ gap: 8 }}>
              <button
                className="btn btn--ghost btn--small"
                style={{ flex: 1 }}
                disabled={!down || !canShift}
                onClick={() => store.shiftVariation(session.id, es.id, -1)}
                aria-label="step down"
                title={down ? down.name : 'bottom of chain'}
              >
                ↓ EASIER{down ? '' : ' (bottom)'}
              </button>
              <button
                className="btn btn--ghost btn--small"
                style={{ flex: 1 }}
                disabled={!up || !canShift}
                onClick={() => store.shiftVariation(session.id, es.id, 1)}
                aria-label="step up"
                title={up ? up.name : 'top of chain'}
              >
                ↑ HARDER{up ? '' : ' (top)'}
              </button>
            </div>
            {!canShift && <div className="tiny faint mt8">Stepping changes the exercise, so it is only available before the first set.</div>}
          </div>
        )}

        {es.cue && <div className="cue mt8">{es.cue}</div>}
        {es.gear && <div className="tiny faint mt8">GEAR · {es.gear.toUpperCase()}</div>}

        {/* ── load ── */}
        {es.bodyweight && es.weight === 0 ? (
          <button className="row mt8" style={{ gap: 12 }} onClick={() => setEditingWeight(true)} aria-label="edit weight">
            <span className="tiny dim">BODYWEIGHT</span>
            <span className="tiny faint" style={{ borderBottom: '1px dashed var(--faint)' }}>+ ADD LOAD (backpack)</span>
          </button>
        ) : (
          <button className="row mt8" style={{ gap: 12 }} onClick={() => setEditingWeight(true)} aria-label="edit weight">
            <span className="weight-display">
              {fmtWeightShort(es)} <span className="unit">{unitLabel(es, state.settings.units)}</span>
            </span>
            <span className="tiny faint" style={{ borderBottom: '1px dashed var(--faint)' }}>EDIT</span>
          </button>
        )}
        {es.perHand && <div className="tiny faint">EACH DUMBBELL · increments of {trimNum(es.increment)} per hand</div>}
        {es.bodyweight && es.weight > 0 && <div className="tiny faint">ADDED LOAD · bodyweight is not counted here</div>}
        {es.weight !== es.suggestedWeight && (
          <div className="tiny amber">MANUAL OVERRIDE (suggested {trimNum(es.suggestedWeight)})</div>
        )}
        {!isChain && es.weight === es.suggestedWeight && suggestion?.basis === 'reduce' && (
          <div className="tiny amber">↓ REDUCE suggested (was {trimNum(suggestion.lastWeight ?? 0)}) · your call, override any time</div>
        )}
        {!isChain && es.weight === es.suggestedWeight && suggestion?.basis === 'increase' && (
          <div className="tiny green">▲ INCREASE from {trimNum(suggestion.lastWeight ?? 0)}</div>
        )}
        {isChain && es.variationBasis === 'top' && es.weight === es.suggestedWeight && es.weight > 0 && (
          <div className="tiny green">▲ LOAD UP · {trimNum(es.weight)} lb in the backpack (was {trimNum(Math.max(0, es.weight - es.increment))})</div>
        )}

        {last ? (
          <div className="last-block">
            LAST · {last.session.date}
            <br />
            {fmtWeightShort(last.es)} × {fmtRepList(last.es.sets.map((s) => s.reps), last.es.timed)}
            {lastLabel && lastLabel.text && (
              <span className={lastLabel.cls}> {lastLabel.glyph} {lastLabel.text.toLowerCase()}</span>
            )}
            {last.es.finalSetRir != null && <span className="faint"> · final RIR {last.es.finalSetRir}</span>}
          </div>
        ) : es.fromName ? (
          <div className="last-block">FIRST TIME ON THIS RUNG · last time: {es.fromName}</div>
        ) : (
          <div className="last-block">FIRST TIME — no previous data</div>
        )}

        <div role="list" aria-label="sets">
          {es.sets.map((set, i) => {
            const stateCls =
              set.reps != null ? 'set-row--done' : i === nextSetIdx ? 'set-row--next' : 'set-row--pending';
            const goal = es.targetReps?.[i];
            const hit = set.reps != null && goal != null && set.reps >= goal;
            return (
              <div key={i} className={`set-row ${stateCls}`} role="listitem">
                <button className="set-row__main" onClick={() => setPicking(i)} aria-label={`set ${i + 1}${goal != null ? `, target ${goal}` : ''}`}>
                  <span className="set-label">
                    SET {i + 1}
                    {i >= es.targetSets ? '+' : ''}
                  </span>
                  <span className={`set-value ${set.reps != null ? (hit ? 'green' : goal != null ? 'amber' : '') : ''}`}>
                    {set.reps != null ? fmtReps(set.reps, es.timed) : goal != null ? <span className={i === nextSetIdx ? 'cyan' : 'dim'}>{fmtReps(goal, es.timed)}</span> : i === nextSetIdx ? '▸' : '—'}
                  </span>
                  <span className="set-target">
                    {set.reps != null
                      ? `× ${fmtWeightShort({ ...es, weight: set.weight })}${goal != null ? ` · goal ${fmtReps(goal, es.timed)}` : ''}`
                      : fmtRange(es.repMin, es.repMax, es.timed)}
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
            <div className="tiny faint">HOLD · SET {hold.setIdx + 1} · TARGET {hold.totalSec}s</div>
            <div className="hold__clock cyan">{Math.ceil(holdRemaining)}</div>
            <div className="rest-track" aria-hidden>
              <i style={{ width: `${Math.min(100, (holdElapsed / hold.totalSec) * 100)}%` }} />
            </div>
            <button className="btn btn--ghost btn--small mt8" style={{ width: '100%' }} onClick={stopHoldEarly}>
              STOP EARLY · log {Math.floor(holdElapsed)}s
            </button>
          </div>
        )}
        {nextSetIdx >= 0 && es.targetReps?.[nextSetIdx] != null && !hold && (
          <div className="tiny faint mt8">
            {es.timed ? '▶ starts a countdown and logs the hold when it ends. Tap the row to enter seconds by hand.' : '✓ logs the target. Tap the row to enter a different number.'}
          </div>
        )}
        {es.finalSetRir != null && (
          <div className="spread tiny mt8" style={{ padding: '0 4px' }}>
            <span className="faint">FINAL SET RIR {es.finalSetRir}</span>
            <button className="faint" style={{ textDecoration: 'underline' }} onClick={() => setRirFor(es.id)}>edit</button>
          </div>
        )}

        <div className="row mt16" style={{ gap: 8 }}>
          <button className="btn btn--ghost btn--small" style={{ flex: 1 }} onClick={() => store.addSet(session.id, es.id)}>
            + SET
          </button>
          {es.sets.length > es.targetSets && (
            <button className="btn btn--ghost btn--small" style={{ flex: 1 }} onClick={() => store.removeLastSet(session.id, es.id)}>
              − SET
            </button>
          )}
          <button className="btn btn--ghost btn--small" style={{ flex: 1 }} onClick={() => setSubstituting(true)}>
            SUBSTITUTE
          </button>
        </div>
        {es.sets.length > es.targetSets && (
          <div className="tiny faint mt8">Extra sets are bonus volume. Only the {es.targetSets} prescribed sets decide {isChain ? 'ADVANCE / HOLD' : 'INCREASE / HOLD'}.</div>
        )}

        {allDone ? (
          <button className="btn btn--green mt16" onClick={finish}>
            COMPLETE WORKOUT ✓
          </button>
        ) : (
          <button className="btn btn--ghost mt16" style={{ width: '100%' }} onClick={() => setConfirmingFinish(true)}>
            FINISH EARLY…
          </button>
        )}
      </div>

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

      {rirEs && (
        <Sheet onClose={() => setRirFor(null)}>
          <div className="spread">
            <div>
              <div className="tiny faint">{rirEs.name.toUpperCase()} · FINAL SET</div>
              <div style={{ fontSize: 18, fontWeight: 800, letterSpacing: '0.08em' }}>RIR?</div>
            </div>
            <button className="btn btn--ghost btn--small" onClick={() => setRirFor(null)}>SKIP</button>
          </div>
          <div className="tiny faint mt8">Reps left in the tank. Optional — never changes your progression.</div>
          <div className="rir-grid" role="group" aria-label="reps in reserve">
            {[0, 1, 2, 3].map((r) => (
              <button
                key={r}
                className={rirEs.finalSetRir === r ? 'cyan' : ''}
                onClick={() => {
                  store.setFinalRir(session.id, rirEs.id, r);
                  setRirFor(null);
                }}
                aria-label={`rir ${r}${r === 3 ? ' or more' : ''}`}
              >
                {r === 3 ? '3+' : r}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {editingWeight && (
        <WeightEditor
          name={es.name}
          weight={es.weight}
          increment={es.increment}
          suggested={es.suggestedWeight}
          bodyweight={es.bodyweight}
          perHand={es.perHand}
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
          title={`SUBSTITUTE ${es.name.toUpperCase()}`}
          forExerciseId={es.exerciseId}
          onPick={(ex) => {
            setSubstituting(false);
            setSubChoice(ex.id);
          }}
          onClose={() => setSubstituting(false)}
        />
      )}

      {subChoice && (
        <Sheet onClose={() => setSubChoice(null)}>
          <div className="tiny faint">SUBSTITUTION SCOPE</div>
          <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>
            {store.exerciseById(subChoice)?.name}
          </div>
          <div className="tiny faint mt8">Progression follows the exercise: the substitute starts from its own history{store.exerciseById(subChoice)?.progressionId ? ', and its chain picks up from whatever you actually do' : ''}.</div>
          <button
            className="btn mt16"
            style={{ width: '100%' }}
            onClick={() => {
              store.substituteExercise(session.id, es.id, subChoice, false);
              setSubChoice(null);
            }}
          >
            TODAY ONLY
          </button>
          <button
            className="btn mt8"
            style={{ width: '100%' }}
            onClick={() => {
              store.substituteExercise(session.id, es.id, subChoice, true);
              setSubChoice(null);
            }}
          >
            REPLACE IN PLAN
          </button>
        </Sheet>
      )}

      {confirmingFinish && (
        <Confirm
          title="Finish with unlogged sets?"
          body="Logged sets are kept. Exercises without all prescribed sets are marked INCOMPLETE and keep their variation and load — no step back is ever triggered by finishing early."
          confirmLabel="FINISH"
          onConfirm={finish}
          onCancel={() => setConfirmingFinish(false)}
        />
      )}

      {confirmingAbort && (
        <Sheet onClose={() => setConfirmingAbort(false)}>
          <div className="tiny faint">LEAVE WORKOUT</div>
          <button className="btn mt16" style={{ width: '100%' }} onClick={onExit}>
            KEEP SESSION OPEN (resume later)
          </button>
          <button
            className="btn btn--danger mt8"
            style={{ width: '100%' }}
            onClick={() => {
              store.abortWorkout(session.id);
              onExit();
            }}
          >
            DISCARD THIS WORKOUT
          </button>
          {loggedCount > 0 && (
            <div className="center faint tiny mt8">discarding deletes {loggedCount} logged set(s) from today</div>
          )}
        </Sheet>
      )}

      {finished && <CompletionOverlay session={finished} onDone={onExit} />}
    </div>
  );
}

function CompletionOverlay({ session, onDone }: { session: WorkoutSession; onDone: () => void }) {
  const state = useAppState();
  const performed = session.exercises.filter((es) => es.sets.some((s) => s.reps != null));
  const increased = performed.filter((es) => es.result === 'increase' || es.result === 'progress');
  const held = performed.filter((es) => es.result === 'hold' || es.result === 'keep');
  const advanced = increased.filter((es) => es.progressionId && es.level != null && es.levelCount != null && es.level < es.levelCount - 1);
  const totalSets = performed.reduce((n, es) => n + es.sets.filter((s) => s.reps != null).length, 0);
  const duration = session.finishedAt ? session.finishedAt - session.startedAt : 0;
  return (
    <div className="complete-overlay">
      <div className="complete-card">
        <div className="tiny faint">SESSION COMPLETE</div>
        <div className="complete-title mt8">{session.name} ✓</div>
        <div className="dim small mt8">
          {totalSets} sets logged{duration > 60000 ? ` · ${formatDuration(duration)}` : ''}
        </div>
        <div className="hr" />
        {performed.map((es) => {
          const isChain = !!es.progressionId;
          const lbl = isChain ? chainResultText(es.result, es) : { ...resultLabel(es.result), detail: '' };
          const complete = isComplete(es);
          const next = isChain && es.result === 'increase' ? adjacentVariation(state.exercises, es.exerciseId, 1) : null;
          const prev = isChain && es.result === 'reduce' ? adjacentVariation(state.exercises, es.exerciseId, -1) : null;
          return (
            <div key={es.id} className="spread mt8">
              <div className="small" style={{ flex: 1 }}>
                {es.name}
                <div className="tiny faint">
                  {fmtWeightShort(es)} × {fmtRepList(es.sets.map((s) => s.reps), es.timed)}
                  {es.targetReps?.length ? (hitAllTargets(es) ? <span className="green"> · target ✓</span> : ` · target ${fmtTargets(es.targetReps, es.timed)}`) : ''}
                  {es.finalSetRir != null ? ` · RIR ${es.finalSetRir}` : ''}
                </div>
              </div>
              <div className={`${lbl.cls} small`} style={{ textAlign: 'right' }}>
                {lbl.glyph} {lbl.text}
                {isChain ? (
                  <div className="tiny">
                    {es.result === 'increase' && next && <>next: {next.name}</>}
                    {es.result === 'increase' && !next && <>top of chain · add load / tempo</>}
                    {es.result === 'reduce' && prev && <>suggest: {prev.name}</>}
                    {(es.result === 'hold' || es.result === 'keep') && <span className="faint">same rung · add reps</span>}
                    {es.result === 'incomplete' && complete === false && <span className="faint">no decision</span>}
                  </div>
                ) : (
                  <>
                    {es.result === 'increase' && (
                      <div className="tiny">next: {fmtWeightShort({ ...es, weight: es.weight + es.increment })}</div>
                    )}
                    {es.result === 'reduce' && (
                      <div className="tiny">suggest: {fmtWeightShort({ ...es, weight: Math.max(0, es.weight - es.increment) })}</div>
                    )}
                    {(es.result === 'hold' || es.result === 'keep') && <div className="tiny faint">same load next time</div>}
                    {es.result === 'incomplete' && complete === false && <div className="tiny faint">no decision</div>}
                  </>
                )}
              </div>
            </div>
          );
        })}
        <div className="dim tiny mt16" style={{ letterSpacing: '0.1em' }}>
          {advanced.length > 0 && <div className="green">▲ ADVANCE ON {advanced.length} CHAIN{advanced.length > 1 ? 'S' : ''}</div>}
          {increased.length > advanced.length && (
            <div className="green">▲ {advanced.length > 0 ? 'ALSO ' : ''}INCREASE ON {increased.length - advanced.length} EXERCISE{increased.length - advanced.length > 1 ? 'S' : ''}</div>
          )}
          {held.length > 0 && <div>= HOLD ON {held.length} · holding while cutting is a good result</div>}
        </div>
        <button className="btn btn--green mt16" onClick={onDone}>
          DONE
        </button>
      </div>
    </div>
  );
}
