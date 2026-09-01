import type { ExerciseSession, WorkoutSession, TemplateExercise } from '../types';

/**
 * StrongLifts-style rep-range progression:
 * every prescribed set logged AND every set reached the TOP of the rep range → progress.
 */
export function exerciseSucceeded(es: ExerciseSession): boolean {
  const logged = es.sets.filter((s) => s.reps != null);
  if (logged.length < es.targetSets) return false;
  return logged.every((s) => (s.reps ?? 0) >= es.repMax);
}

export function computeResult(es: ExerciseSession): 'progress' | 'keep' {
  return exerciseSucceeded(es) ? 'progress' : 'keep';
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

/**
 * Weight to suggest for the next session of an exercise.
 * Based on what actually happened last time (so manual overrides are respected).
 */
export function suggestWeight(
  sessions: WorkoutSession[],
  exerciseId: string,
  tpl: Pick<TemplateExercise, 'increment' | 'startWeight'>,
): { weight: number; fromProgress: boolean } {
  const last = lastPerformance(sessions, exerciseId);
  if (!last) return { weight: tpl.startWeight, fromProgress: false };
  const lastWeight = last.es.weight;
  if (exerciseSucceeded(last.es)) {
    return { weight: lastWeight + (last.es.increment || tpl.increment), fromProgress: true };
  }
  return { weight: lastWeight, fromProgress: false };
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

/** Per-session history for one exercise, oldest first */
export function exerciseHistory(sessions: WorkoutSession[], exerciseId: string) {
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
            weight: es.weight,
            reps: logged.map((x) => x.reps as number),
            volume: logged.reduce((sum, x) => sum + (x.reps as number) * x.weight, 0),
            result: es.result,
          };
        }),
    );
}

/** Simple trailing moving average for body weight */
export function movingAverage(
  points: { date: string; value: number }[],
  windowDays: number,
): { date: string; value: number }[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((p, i) => {
    const windowStart = new Date(p.date + 'T00:00:00');
    windowStart.setDate(windowStart.getDate() - (windowDays - 1));
    const inWindow = sorted.slice(0, i + 1).filter((q) => new Date(q.date + 'T00:00:00') >= windowStart);
    const avg = inWindow.reduce((s, q) => s + q.value, 0) / inWindow.length;
    return { date: p.date, value: Math.round(avg * 10) / 10 };
  });
}
