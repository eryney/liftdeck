import type { Exercise, ExerciseSession, TemplateExercise, VariationBasis, WorkoutSession } from '../types';
import { chainFor } from '../data/progressions';
import { assessWithHistory, lastPerformance } from './progression';

/**
 * VARIATION PROGRESSION — the bodyweight analogue of adding weight.
 *
 * A template slot names a variation (e.g. "push-up"). If that variation belongs to a chain, the
 * session does not blindly use it: it looks at the most recent exposure of ANY rung of that chain
 * and applies the same double-progression verdict used for loads:
 *
 *   INCREASE  (every prescribed set at the rep ceiling) → next rung         basis 'advance'
 *             … unless already on the last rung           → same rung         basis 'top'
 *   REDUCE    (second consecutive below-range exposure)   → previous rung     basis 'regress'
 *   HOLD / INCOMPLETE                                      → same rung         basis 'hold'
 *   no history in the chain                               → the slot's rung   basis 'start'
 *
 * Decisions derive from what was actually performed, so stepping up/down by hand or substituting
 * within the chain is respected next time. Slots marked `lockVariation` never move.
 */

export interface VariationChoice {
  exerciseId: string;
  basis: VariationBasis;
  level: number;
  levelCount: number;
  progressionId: string;
  /** rung performed last time, when the choice differs from it */
  fromExerciseId?: string;
  /** most recent exposure in the chain, if any */
  last?: { session: WorkoutSession; es: ExerciseSession };
}

/** Most recent completed exposure of any rung in `chainIds`. */
export function lastChainPerformance(
  sessions: WorkoutSession[],
  chainIds: string[],
  before?: number,
): { session: WorkoutSession; es: ExerciseSession } | null {
  const ids = new Set(chainIds);
  const sorted = [...sessions]
    .filter((s) => s.status === 'completed' && (before == null || s.startedAt < before))
    .sort((a, b) => b.startedAt - a.startedAt);
  for (const session of sorted) {
    const es = session.exercises.find((e) => ids.has(e.exerciseId) && e.sets.some((x) => x.reps != null));
    if (es) return { session, es };
  }
  return null;
}

export function resolveVariation(
  sessions: WorkoutSession[],
  exercises: Exercise[],
  slot: Pick<TemplateExercise, 'exerciseId' | 'lockVariation'>,
  before?: number,
): VariationChoice | null {
  if (slot.lockVariation) return null;
  const chain = chainFor(exercises, slot.exerciseId);
  if (chain.length === 0) return null;
  const ids = chain.map((e) => e.id);
  const progressionId = chain[0].progressionId as string;
  const startIdx = Math.max(0, ids.indexOf(slot.exerciseId));

  const last = lastChainPerformance(sessions, ids, before);
  if (!last) return { exerciseId: slot.exerciseId, basis: 'start', level: startIdx, levelCount: ids.length, progressionId };

  const lastIdx = ids.indexOf(last.es.exerciseId);
  const prior = lastPerformance(sessions, last.es.exerciseId, last.session.startedAt);
  const verdict = assessWithHistory(last.es, prior?.es ?? null);

  let idx = lastIdx;
  let basis: VariationBasis = 'hold';
  if (verdict === 'increase') {
    if (lastIdx < ids.length - 1) {
      idx = lastIdx + 1;
      basis = 'advance';
    } else {
      basis = 'top';
    }
  } else if (verdict === 'reduce' && lastIdx > 0) {
    idx = lastIdx - 1;
    basis = 'regress';
  }
  const exerciseId = ids[idx];
  return {
    exerciseId,
    basis,
    level: idx,
    levelCount: ids.length,
    progressionId,
    ...(exerciseId !== last.es.exerciseId ? { fromExerciseId: last.es.exerciseId } : {}),
    last,
  };
}

/** Neighbouring rung for manual step up/down. */
export function adjacentVariation(exercises: Exercise[], exerciseId: string, dir: -1 | 1): Exercise | null {
  const chain = chainFor(exercises, exerciseId);
  const idx = chain.findIndex((e) => e.id === exerciseId);
  if (idx < 0) return null;
  return chain[idx + dir] ?? null;
}

/** Human text for why today's variation was chosen. */
export function basisText(c: Pick<ExerciseSession, 'variationBasis' | 'fromName' | 'level' | 'levelCount'>): { text: string; cls: string } | null {
  switch (c.variationBasis) {
    case 'advance':
      return { text: `▲ ADVANCE${c.fromName ? ` from ${c.fromName}` : ''} · rep ceiling hit last time`, cls: 'green' };
    case 'regress':
      return { text: `↓ STEP BACK${c.fromName ? ` from ${c.fromName}` : ''} · two sessions below range · your call`, cls: 'amber' };
    case 'top':
      return { text: '▲ TOP OF CHAIN · ceiling hit · add load, a pause, or a slower eccentric', cls: 'green' };
    case 'hold':
      return { text: '= HOLD · same variation · chase the rep ceiling', cls: 'dim' };
    case 'start':
      return { text: 'STARTING RUNG · step up or down if this is wrong for you', cls: 'faint' };
    case 'manual':
      return { text: 'MANUAL · you picked this rung today', cls: 'purple' };
    default:
      return null;
  }
}

/** Result label text for an exercise that progresses by variation rather than load. */
export function chainResultText(
  result: ExerciseSession['result'],
  es: Pick<ExerciseSession, 'level' | 'levelCount'>,
): { text: string; glyph: string; cls: string; detail: string } {
  const atTop = es.level != null && es.levelCount != null && es.level >= es.levelCount - 1;
  switch (result) {
    case 'increase':
    case 'progress':
      return atTop
        ? { text: 'TOP OF CHAIN', glyph: '▲', cls: 'green', detail: 'add load / pause / slower eccentric' }
        : { text: 'ADVANCE', glyph: '▲', cls: 'green', detail: 'next variation next time' };
    case 'reduce':
      return { text: 'STEP BACK', glyph: '↓', cls: 'amber', detail: 'easier variation suggested' };
    case 'incomplete':
      return { text: 'INCOMPLETE', glyph: '·', cls: 'faint', detail: 'no decision' };
    case 'hold':
    case 'keep':
      return { text: 'HOLD', glyph: '=', cls: 'dim', detail: 'same variation · add reps' };
    default:
      return { text: '', glyph: '', cls: 'faint', detail: '' };
  }
}
