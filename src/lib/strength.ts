import type { BodyMeasurement, WorkoutSession } from '../types';
import { bodyweightNear } from './body';
import { exerciseHistory } from './progression';

/**
 * Conservative strength-maintenance telemetry.
 * ESTIMATED 1RM (Epley) from work sets in a sensible rep range; rolling mean of the last 3
 * exposures compared with the 3 before. Labels only — no claims about muscle gained or lost.
 */

export const E1RM_MAX_REPS = 12;

export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30);
}

/** Best e1RM for one exposure. Uses only sets with 1–12 reps and load > 0. */
export function exposureE1RM(sets: { reps: number | null; weight: number }[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (s.reps == null || s.reps <= 0 || s.reps > E1RM_MAX_REPS || s.weight <= 0) continue;
    const v = epley(s.weight, s.reps);
    if (best == null || v > best) best = v;
  }
  return best == null ? null : Math.round(best * 10) / 10;
}

export type TrendLabel = 'improving' | 'maintained' | 'down' | 'baseline';

export interface StrengthTrend {
  exerciseId: string;
  /** e1RM per exposure, oldest first (null where no qualifying set) */
  points: { date: string; value: number }[];
  recent: number | null; // mean of last 3
  prior: number | null; // mean of the 3 before those
  label: TrendLabel;
  /** relative change recent vs prior */
  pct: number | null;
  /** true when e1RM includes bodyweight (total system load) */
  systemLoad: boolean;
}

export const IMPROVE_THRESHOLD = 0.025;
export const DECLINE_THRESHOLD = 0.025;

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/**
 * Bodyweight exercises use TOTAL SYSTEM LOAD (bodyweight near the date + added load) when a body
 * weight is available within ±7 days; otherwise they are skipped (added load alone misleads during a cut).
 */
export function strengthTrend(
  sessions: WorkoutSession[],
  exerciseId: string,
  measurements: BodyMeasurement[] = [],
): StrengthTrend {
  const points: { date: string; value: number }[] = [];
  let systemLoad = false;
  const completed = sessions.filter((s) => s.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  for (const s of completed) {
    for (const es of s.exercises) {
      if (es.exerciseId !== exerciseId || !es.sets.some((x) => x.reps != null)) continue;
      let sets = es.sets.filter((x) => x.reps != null);
      if (es.bodyweight) {
        const bw = bodyweightNear(measurements, s.date);
        if (bw == null) continue;
        systemLoad = true;
        sets = sets.map((x) => ({ ...x, weight: x.weight + bw }));
      }
      const v = exposureE1RM(sets);
      if (v != null) points.push({ date: s.date, value: v });
    }
  }
  const vals = points.map((p) => p.value);
  const recentVals = vals.slice(-3);
  const priorVals = vals.slice(-6, -3);
  const recent = recentVals.length ? Math.round(mean(recentVals) * 10) / 10 : null;
  const prior = priorVals.length >= 2 ? Math.round(mean(priorVals) * 10) / 10 : null;
  let label: TrendLabel = 'baseline';
  let pct: number | null = null;
  if (recent != null && prior != null && recentVals.length >= 3) {
    pct = Math.round(((recent - prior) / prior) * 1000) / 10;
    if (recent >= prior * (1 + IMPROVE_THRESHOLD)) label = 'improving';
    else if (recent <= prior * (1 - DECLINE_THRESHOLD) && recentVals.every((v) => v < prior)) label = 'down'; // persistent, not one bad day
    else label = 'maintained';
  }
  return { exerciseId, points, recent, prior, label, pct, systemLoad };
}

export function trendLabelText(l: TrendLabel): { text: string; glyph: string; cls: string } {
  switch (l) {
    case 'improving':
      return { text: 'IMPROVING', glyph: '↑', cls: 'green' };
    case 'down':
      return { text: 'TRENDING DOWN', glyph: '↓', cls: 'amber' };
    case 'maintained':
      return { text: 'MAINTAINED', glyph: '=', cls: 'cyan' };
    default:
      return { text: 'BUILDING BASELINE', glyph: '·', cls: 'faint' };
  }
}

/** Total system load rows for a bodyweight exercise (pull-ups during a cut). */
export function systemLoadHistory(sessions: WorkoutSession[], exerciseId: string, measurements: BodyMeasurement[]) {
  return exerciseHistory(sessions, exerciseId)
    .map((h) => {
      const bw = bodyweightNear(measurements, h.date);
      return bw == null ? null : { date: h.date, added: h.weight, bodyweight: bw, total: Math.round((bw + h.weight) * 10) / 10 };
    })
    .filter((x): x is { date: string; added: number; bodyweight: number; total: number } => x !== null);
}
