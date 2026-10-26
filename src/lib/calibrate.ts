import type { WorkoutTemplate } from '../types';

/**
 * STARTING RUNGS — three questions on day one so the first session is neither a wall nor a warm-up.
 *
 * A template slot names a starting variation; with no history the chain starts there. Calibration just
 * rewrites those starting variations. Everything after that is driven by what you actually do.
 * Thresholds follow the r/bodyweightfitness Recommended Routine graduation points (3×8 → next rung).
 */

export type PullLevel = '0' | '1-4' | '5-11' | '12+';
export type PushLevel = '0-4' | '5-14' | '15-29' | '30+';
export type SquatLevel = 'squats' | 'split' | 'pistol';

export interface Calibration {
  pull: PullLevel;
  push: PushLevel;
  squat: SquatLevel;
  bands: boolean;
}

export const DEFAULT_CALIBRATION: Calibration = { pull: '5-11', push: '5-14', squat: 'split', bands: false };

/** Map from a template's default starting exercise → the calibrated starting exercise. */
export function startingRungs(c: Calibration): Record<string, string> {
  const out: Record<string, string> = {};
  // vertical pulls
  if (c.pull === '0') {
    out['pull-up'] = 'negative-pull-up';
    out['chin-up'] = 'negative-chin-up';
  } else if (c.pull === '1-4') {
    out['pull-up'] = c.bands ? 'band-assisted-pull-up' : 'negative-pull-up';
    out['chin-up'] = c.bands ? 'band-assisted-chin-up' : 'negative-chin-up';
  } else if (c.pull === '12+') {
    out['pull-up'] = 'archer-pull-up';
    out['chin-up'] = 'archer-chin-up';
  }
  // pushes
  if (c.push === '0-4') {
    out['push-up'] = 'incline-push-up';
    out['chair-dip'] = 'bench-dip';
  } else if (c.push === '5-14') {
    out['chair-dip'] = 'bench-dip-elevated';
  } else if (c.push === '15-29') {
    out['push-up'] = 'diamond-push-up';
    out['pike-push-up'] = 'elevated-pike-push-up';
  } else if (c.push === '30+') {
    out['push-up'] = 'pseudo-planche-push-up';
    out['pike-push-up'] = 'elevated-pike-push-up';
  }
  // legs
  if (c.squat === 'squats') {
    out['bulgarian-split-squat-bw'] = 'bodyweight-squat';
  } else if (c.squat === 'pistol') {
    out['bulgarian-split-squat-bw'] = 'pistol-squat';
    out['reverse-lunge'] = 'skater-squat';
  }
  return out;
}

export function applyCalibration(templates: WorkoutTemplate[], c: Calibration): WorkoutTemplate[] {
  const map = startingRungs(c);
  return templates.map((t) => ({
    ...t,
    exercises: t.exercises.map((te) => (map[te.exerciseId] ? { ...te, exerciseId: map[te.exerciseId] } : te)),
  }));
}
