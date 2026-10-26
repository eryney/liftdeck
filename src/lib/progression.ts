import type { ExerciseResult, ExerciseSession, WorkoutSession, TemplateExercise } from '../types';

/**
 * DOUBLE PROGRESSION — INCREASE / HOLD / REDUCE.
 *
 * Only the PRESCRIBED sets (the first `targetSets`) are evaluated. Extra sets are bonus
 * training: they appear in history and volume, never in this decision.
 *
 *   INCREASE   every prescribed set logged AND every one reached repMax or higher
 *   HOLD       every prescribed set logged, but the increase criterion was not met (not a failure)
 *   REDUCE     the second CONSECUTIVE complete exposure at the SAME load where any prescribed set
 *              fell below repMin → suggest one increment lower next time (a suggestion, not a rule)
 *   INCOMPLETE fewer than the prescribed sets were logged → no decision, weight is kept
 *
 * RIR is optional telemetry and never affects any of this.
 */

export type Assessment = 'increase' | 'hold' | 'incomplete';

export function prescribedSets(es: ExerciseSession) {
  return es.sets.slice(0, es.targetSets);
}

export function isComplete(es: ExerciseSession): boolean {
  const p = prescribedSets(es);
  return p.length >= es.targetSets && p.every((s) => s.reps != null);
}

/** Increase criterion on prescribed sets only. */
export function assess(es: ExerciseSession): Assessment {
  if (!isComplete(es)) return 'incomplete';
  // a deload is a deliberate easy session: it can never advance the chain
  if (es.deload) return 'hold';
  return prescribedSets(es).every((s) => (s.reps ?? 0) >= es.repMax) ? 'increase' : 'hold';
}

/** Legacy alias: true only for INCREASE (kept for older callers/tests). */
export function exerciseSucceeded(es: ExerciseSession): boolean {
  return assess(es) === 'increase';
}

/** Any prescribed set below repMin in a COMPLETE exposure. */
export function belowRange(es: ExerciseSession): boolean {
  if (!isComplete(es)) return false;
  return prescribedSets(es).some((s) => (s.reps ?? 0) < es.repMin);
}

/**
 * Full result for an exposure, given the previous completed exposure of the same exercise (if any).
 * REDUCE requires: this exposure below range AND the prior one below range at the same load.
 * A successful/hold exposure in between, a load change, or an incomplete prior exposure resets that.
 */
export function assessWithHistory(es: ExerciseSession, prior: ExerciseSession | null): ExerciseResult {
  const a = assess(es);
  if (a !== 'hold') return a;
  if (es.deload) return 'hold';
  if (belowRange(es) && prior && prior.weight === es.weight && belowRange(prior)) return 'reduce';
  return 'hold';
}

/** Most recent completed session containing this exercise with at least one logged set */
export function lastPerformance(
  sessions: WorkoutSession[],
  exerciseId: string,
  before?: number,
): { session: WorkoutSession; es: ExerciseSession } | null {
  const sorted = [...sessions]
    .filter((s) => s.status === 'completed' && (before == null || s.startedAt < before))
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const session of sorted) {
    const es = session.exercises.find(
      (e) => e.exerciseId === exerciseId && e.sets.some((x) => x.reps != null),
    );
    if (es) return { session, es };
  }
  return null;
}

/** Result for an exercise inside `session`, evaluated against the exposure that came before it. */
export function computeResult(es: ExerciseSession, sessions: WorkoutSession[], session: Pick<WorkoutSession, 'id' | 'startedAt'>): ExerciseResult {
  const prior = lastPerformance(
    sessions.filter((s) => s.id !== session.id),
    es.exerciseId,
    session.startedAt,
  );
  return assessWithHistory(es, prior?.es ?? null);
}

export type SuggestionBasis = 'start' | 'increase' | 'hold' | 'reduce' | 'incomplete';

/**
 * Weight to suggest for the next session of an exercise.
 * Derived from what actually happened last time, so manual overrides are respected
 * and editing a template never rewrites the suggestion history.
 */
export function suggestWeight(
  sessions: WorkoutSession[],
  exerciseId: string,
  tpl: Pick<TemplateExercise, 'increment' | 'startWeight'>,
): { weight: number; basis: SuggestionBasis; fromProgress: boolean; lastWeight?: number } {
  const last = lastPerformance(sessions, exerciseId);
  if (!last) return { weight: tpl.startWeight, basis: 'start', fromProgress: false };
  const prior = lastPerformance(sessions, exerciseId, last.session.startedAt);
  const result = assessWithHistory(last.es, prior?.es ?? null);
  const inc = last.es.increment || tpl.increment;
  const lastWeight = last.es.weight;
  if (result === 'increase') return { weight: round1(lastWeight + inc), basis: 'increase', fromProgress: true, lastWeight };
  if (result === 'reduce') return { weight: Math.max(0, round1(lastWeight - inc)), basis: 'reduce', fromProgress: false, lastWeight };
  return { weight: lastWeight, basis: result === 'incomplete' ? 'incomplete' : 'hold', fromProgress: false, lastWeight };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Display label for any stored result, including v1 values.
 * Pass `chain` for exercises that progress by variation: INCREASE reads ADVANCE and REDUCE reads STEP BACK.
 */
export function resultLabel(r: ExerciseResult | undefined, chain = false): { text: string; glyph: string; cls: string } {
  switch (r) {
    case 'increase':
    case 'progress':
      return { text: chain ? 'Advance' : 'Increase', glyph: '▲', cls: 'green' };
    case 'reduce':
      return { text: chain ? 'Step back' : 'Reduce', glyph: '↓', cls: 'amber' };
    case 'incomplete':
      return { text: 'Incomplete', glyph: '·', cls: 'faint' };
    case 'hold':
    case 'keep':
      return { text: 'Hold', glyph: '=', cls: 'muted' };
    default:
      return { text: '', glyph: '', cls: 'faint' };
  }
}

export function isIncrease(r: ExerciseResult | undefined): boolean {
  return r === 'increase' || r === 'progress';
}

/** Best (heaviest weight, then most reps at that weight) single set ever logged */
export function bestSet(sessions: WorkoutSession[], exerciseId: string): { weight: number; reps: number; date: string } | null {
  let best: { weight: number; reps: number; date: string } | null = null;
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    for (const es of s.exercises) {
      if (es.exerciseId !== exerciseId) continue;
      for (const set of es.sets) {
        if (set.reps == null || set.reps === 0) continue;
        if (!best || set.weight > best.weight || (set.weight === best.weight && set.reps > best.reps)) {
          best = { weight: set.weight, reps: set.reps, date: s.date };
        }
      }
    }
  }
  return best;
}

export interface ExposureRow {
  date: string;
  startedAt: number;
  weight: number;
  reps: number[];
  /** reps of prescribed sets only */
  prescribedReps: number[];
  volume: number;
  result?: ExerciseResult;
  bodyweight?: boolean;
  deload?: boolean;
  level?: number;
  targetReps?: number[];
}

/** Per-session history for one exercise, oldest first */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string): ExposureRow[] {
  return sessions
    .filter((s) => s.status === 'completed')
    .sort((a, b) => a.startedAt - b.startedAt)
    .flatMap((s) =>
      s.exercises
        .filter((es) => es.exerciseId === exerciseId && es.sets.some((x) => x.reps != null))
        .map((es) => {
          const logged = es.sets.filter((x) => x.reps != null);
          return {
            date: s.date,
            startedAt: s.startedAt,
            weight: es.weight,
            reps: logged.map((x) => x.reps as number),
            prescribedReps: prescribedSets(es).filter((x) => x.reps != null).map((x) => x.reps as number),
            volume: logged.reduce((sum, x) => sum + (x.reps as number) * x.weight, 0),
            result: es.result,
            bodyweight: es.bodyweight,
            ...(es.deload ? { deload: true } : {}),
            ...(es.level != null ? { level: es.level } : {}),
            ...(es.targetReps ? { targetReps: es.targetReps } : {}),
          };
        }),
    );
}

export { movingAverage } from './body';
