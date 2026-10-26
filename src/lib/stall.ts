import type { ExerciseSession, WorkoutSession } from '../types';
import { isComplete, prescribedSets } from './progression';

/**
 * STALL DETECTION — when the same rung at the same load stops moving.
 *
 * Progression on a rung is +1 rep (or +5 s) per session until every set is at the ceiling. When that
 * climb stops, grinding the same numbers for weeks is the classic bodyweight dead end. The rule:
 *
 *   look at the most recent COMPLETE exposures of this exact rung at this exact load, newest first,
 *   stopping at any deload (a deload restarts the count);
 *   if there are at least STALL_SESSIONS of them and the total prescribed reps of the newest is no
 *   higher than the total of the oldest in that window → STALLED.
 *
 * Two ways out, both one tap in the session (see Store.applyDeload / Store.shiftVariation):
 *   DELOAD     targets reset to the floor of the range for this one session, then climb again.
 *              Cheap, keeps the pattern, and a step back in volume is what Overcoming Gravity and the
 *              Coleman 2024 deload trial both support when the climb stalls.
 *   EASIER RUNG do the previous variation for a block of volume, then come back.
 */

export const STALL_SESSIONS = 3;

export interface StallInfo {
  /** consecutive complete exposures in the window */
  sessions: number;
  /** total prescribed reps on the oldest and newest exposure in the window */
  from: number;
  to: number;
}

export function totalPrescribed(es: ExerciseSession): number {
  return prescribedSets(es).reduce((n, s) => n + (s.reps ?? 0), 0);
}

/** Completed exposures of `exerciseId` at `weight`, newest first, up to (and excluding) the latest deload. */
export function rungWindow(sessions: WorkoutSession[], exerciseId: string, weight: number, before?: number): ExerciseSession[] {
  const sorted = [...sessions]
    .filter((s) => s.status === 'completed' && (before == null || s.startedAt < before))
    .sort((a, b) => b.startedAt - a.startedAt);
  const out: ExerciseSession[] = [];
  for (const s of sorted) {
    for (const es of s.exercises) {
      if (es.exerciseId !== exerciseId || !es.sets.some((x) => x.reps != null)) continue;
      if (es.weight !== weight) return out; // a different load breaks the window
      if (es.deload) return out;
      if (!isComplete(es)) continue; // an incomplete session is skipped, not counted
      out.push(es);
    }
  }
  return out;
}

export function detectStall(sessions: WorkoutSession[], exerciseId: string, weight: number, before?: number): StallInfo | null {
  const win = rungWindow(sessions, exerciseId, weight, before);
  if (win.length < STALL_SESSIONS) return null;
  const recent = win.slice(0, STALL_SESSIONS);
  const to = totalPrescribed(recent[0]);
  const from = totalPrescribed(recent[recent.length - 1]);
  if (to > from) return null;
  return { sessions: win.length, from, to };
}
