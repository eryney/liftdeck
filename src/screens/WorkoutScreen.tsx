import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import type { ExerciseSession, WorkoutSession } from '../types';
import { RepPicker } from '../components/RepPicker';
import { WeightEditor } from '../components/WeightEditor';
import { ExercisePicker } from '../components/ExercisePicker';
import { Confirm, Sheet } from '../components/Sheet';
import { fmtWeightFull, fmtWeightShort, trimNum } from '../lib/format';
import { lastPerformance } from '../lib/progression';
import { formatDuration } from '../lib/dates';

function exDone(es: ExerciseSession): boolean {
  return es.sets.filter((s) => s.reps != null).length >= es.targetSets;
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

  const es = session?.exercises[idx];

  const last = useMemo(
    () => (es && session ? lastPerformance(state.sessions, es.exerciseId, session.startedAt) : null),
    [es?.exerciseId, state.sessions, session?.startedAt],
  );

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
  const loggedCount = es.sets.filter((s) => s.reps != null).length;
  const nextSetIdx = es.sets.findIndex((s) => s.reps == null);

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

        <h3 className="ex-name mt8">{es.name.toUpperCase()}</h3>
        {es.substitutedFor && <div className="tiny purple">SUBSTITUTED FOR {es.substitutedFor.toUpperCase()}</div>}
        <div className="tiny faint mt8">
          {es.targetSets} × {es.repMin}–{es.repMax}
          {es.perSide ? ' PER SIDE' : ''} · REST {Math.floor(es.restSec / 60)}:{String(es.restSec % 60).padStart(2, '0')}
        </div>

        <button className="row mt8" style={{ gap: 12 }} onClick={() => setEditingWeight(true)}>
          <span className="weight-display">
            {fmtWeightShort(es)} <span className="unit">{es.bodyweight && es.weight === 0 ? '' : state.settings.units.toUpperCase()}{es.perHand ? ' / HAND' : ''}</span>
          </span>
          <span className="tiny faint" style={{ borderBottom: '1px dashed var(--faint)' }}>EDIT</span>
        </button>
        {es.weight !== es.suggestedWeight && (
          <div className="tiny amber">MANUAL OVERRIDE (suggested {trimNum(es.suggestedWeight)})</div>
        )}

        {last ? (
          <div className="last-block">
            LAST · {last.session.date}
            <br />
            {fmtWeightShort(last.es)} × {last.es.sets.filter((s) => s.reps != null).map((s) => s.reps).join(', ')}
            {last.es.result === 'progress' && <span className="green"> ▲ progressed</span>}
          </div>
        ) : (
          <div className="last-block">FIRST TIME — no previous data</div>
        )}

        <div role="list" aria-label="sets">
          {es.sets.map((set, i) => {
            const stateCls =
              set.reps != null ? 'set-row--done' : i === nextSetIdx ? 'set-row--next' : 'set-row--pending';
            return (
              <button key={i} className={`set-row ${stateCls}`} onClick={() => setPicking(i)} role="listitem">
                <span className="set-label">
                  SET {i + 1}
                  {i >= es.targetSets ? '+' : ''}
                </span>
                <span className="set-value">{set.reps != null ? set.reps : i === nextSetIdx ? '▸' : '—'}</span>
                <span className="set-target">
                  {set.reps != null
                    ? `× ${fmtWeightShort({ ...es, weight: set.weight })}`
                    : `${es.repMin}–${es.repMax}`}
                </span>
              </button>
            );
          })}
        </div>

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
          body="Logged sets are kept; empty sets are ignored for progression."
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
  const performed = session.exercises.filter((es) => es.sets.some((s) => s.reps != null));
  const progressed = performed.filter((es) => es.result === 'progress');
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
        {performed.map((es) => (
          <div key={es.id} className="spread mt8">
            <div className="small" style={{ flex: 1 }}>
              {es.name}
              <div className="tiny faint">
                {fmtWeightShort(es)} × {es.sets.filter((s) => s.reps != null).map((s) => s.reps).join(', ')}
              </div>
            </div>
            {es.result === 'progress' ? (
              <div className="green small" style={{ textAlign: 'right' }}>
                ▲ +{trimNum(es.increment)}
                <div className="tiny">next: {fmtWeightShort({ ...es, weight: es.weight + es.increment })}</div>
              </div>
            ) : (
              <div className="faint tiny">KEEP {fmtWeightShort(es)}</div>
            )}
          </div>
        ))}
        {progressed.length > 0 && (
          <div className="green small mt16" style={{ letterSpacing: '0.1em' }}>
            ▲ PROGRESSION ACHIEVED ON {progressed.length} EXERCISE{progressed.length > 1 ? 'S' : ''}
          </div>
        )}
        <button className="btn btn--green mt16" onClick={onDone}>
          DONE
        </button>
      </div>
    </div>
  );
}
