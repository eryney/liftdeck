import type { ExerciseSession } from '../types';
import { prescribedSets } from './progression';

/**
 * EXACT REP TARGETS — the app says how many, you tap ✓.
 *
 * A fresh rung starts at the floor of the range on every set. On the same rung, the next target is
 * built from what was actually done last time:
 *
 *   every prescribed set reached its target (or the floor, for sessions without targets)
 *       → add one rep to EVERY set                       8,8,8 → 9,9,9
 *   otherwise
 *       → add one rep in total, front-loaded             10,9,9 → 10,10,9
 *
 * Every set is clamped into [repMin, repMax]; a set that fell below the floor is prescribed the
 * floor again. When every set is at the ceiling, the double-progression verdict already said
 * INCREASE / ADVANCE, so a new rung (or a new load) starts back at the floor.
 * Timed holds use the same rules in 5-second steps. After a deload session the targets restart at
 * floor + 1 (or + 5 s), regardless of what was done on the deload day.
 */

export function repStep(timed?: boolean): number {
  return timed ? 5 : 1;
}

export interface PrescribeInput {
  sets: number;
  repMin: number;
  repMax: number;
  timed?: boolean;
  /** last completed exposure on THIS rung and load, if any */
  last?: Pick<ExerciseSession, 'sets' | 'targetSets' | 'targetReps' | 'repMin' | 'deload'> | null;
}

export function prescribeReps({ sets, repMin, repMax, timed, last }: PrescribeInput): number[] {
  const step = repStep(timed);
  const clamp = (n: number) => Math.min(repMax, Math.max(repMin, n));
  if (!last) return Array.from({ length: sets }, () => repMin);
  // after a deload the climb restarts one step above the floor, whatever was actually done that day
  if (last.deload) return Array.from({ length: sets }, () => clamp(repMin + step));
  const done = prescribedSets(last as ExerciseSession)
    .map((s) => s.reps)
    .filter((r): r is number => r != null);
  if (done.length === 0) return Array.from({ length: sets }, () => repMin);
  // targets the last session was given; sessions without targets count the floor as the target
  const goals = done.map((_, i) => last.targetReps?.[i] ?? last.repMin ?? repMin);
  const allHit = done.every((r, i) => r >= goals[i]);
  const anyBelowFloor = done.some((r) => r < repMin);
  const base = Array.from({ length: sets }, (_, i) => clamp(done[i] ?? done[done.length - 1]));
  if (allHit) return base.map((r) => clamp(r + step));
  // a set under the floor: repeat the session at the floor (the sets that were fine keep their reps)
  if (anyBelowFloor) return base;
  // +1 (or +5 s) in total, given to the first set that can still grow
  const total = base.reduce((a, b) => a + b, 0) + step;
  return distribute(total, sets, repMin, repMax, step);
}

/** Spread `total` over `sets` as evenly as possible, descending, inside [min, max], rounded to `step`. */
function distribute(total: number, sets: number, min: number, max: number, step: number): number[] {
  const t = Math.min(total, max * sets);
  const units = Math.round(t / step);
  const per = Math.floor(units / sets);
  const extra = units - per * sets;
  return Array.from({ length: sets }, (_, i) => Math.min(max, Math.max(min, (per + (i < extra ? 1 : 0)) * step)));
}

/** True when every prescribed, logged set met its target. */
export function hitAllTargets(es: Pick<ExerciseSession, 'sets' | 'targetSets' | 'targetReps'>): boolean {
  if (!es.targetReps) return false;
  const p = es.sets.slice(0, es.targetSets);
  return p.length > 0 && p.every((s, i) => s.reps != null && s.reps >= (es.targetReps?.[i] ?? 0));
}

export function fmtTargets(targets: number[] | undefined, timed?: boolean): string {
  if (!targets?.length) return '';
  return targets.map((t) => (timed ? `${t}s` : String(t))).join(' · ');
}
