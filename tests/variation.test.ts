import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY } from '../src/data/exercises';
import { PROGRESSIONS, chainFor, chainLevels } from '../src/data/progressions';
import { adjacentVariation, basisText, chainResultText, lastChainPerformance, resolveVariation } from '../src/lib/variation';
import type { ExerciseSession, WorkoutSession } from '../src/types';

const lib = EXERCISE_LIBRARY;

function es(exerciseId: string, reps: number[], over: Partial<ExerciseSession> = {}): ExerciseSession {
  return {
    id: `es-${exerciseId}-${reps.join('')}`,
    exerciseId,
    name: exerciseId,
    bodyweight: true,
    targetSets: 3,
    repMin: 8,
    repMax: 12,
    restSec: 75,
    increment: 5,
    suggestedWeight: 0,
    weight: 0,
    sets: reps.map((r) => ({ reps: r, weight: over.weight ?? 0 })),
    ...over,
  };
}

let t = 1000;
function ws(exercises: ExerciseSession[], date = '2026-09-01'): WorkoutSession {
  t += 1000;
  return { id: `ws-${t}`, date, name: 'Upper A', status: 'completed', startedAt: t, exercises };
}

describe('exercise library chains', () => {
  it('every chain is contiguous from level 0, homogeneous in timing, and named in PROGRESSIONS', () => {
    const ids = new Set(lib.filter((e) => e.progressionId).map((e) => e.progressionId as string));
    expect(ids.size).toBe(PROGRESSIONS.length);
    for (const id of ids) {
      expect(PROGRESSIONS.some((p) => p.id === id), `progression ${id} is named`).toBe(true);
      const levels = chainLevels(lib, id);
      expect(levels.length).toBeGreaterThanOrEqual(3);
      levels.forEach((e, i) => expect(e.level, `${id} rung ${i}`).toBe(i));
      expect(new Set(levels.map((e) => !!e.timed)).size, `${id} mixes timed and rep rungs`).toBe(1);
      levels.forEach((e) => expect(e.bodyweight, `${e.id} is bodyweight`).toBe(true));
      levels.forEach((e) => expect(e.cue, `${e.id} has a cue`).toBeTruthy());
    }
    expect(new Set(lib.map((e) => e.id)).size).toBe(lib.length);
    // nothing but bodyweight and band work
    expect(lib.every((e) => e.equipment === 'bodyweight' || e.equipment === 'band')).toBe(true);
  });

  it('the bar chains run from the first regression to the one-arm / full skill', () => {
    expect(chainFor(lib, 'pull-up').map((e) => e.id)).toEqual([
      'scapular-pull-up', 'negative-pull-up', 'band-assisted-pull-up', 'pull-up', 'archer-pull-up', 'typewriter-pull-up',
      'one-arm-pull-up-negative', 'one-arm-pull-up-assisted', 'one-arm-pull-up',
    ]);
    expect(chainFor(lib, 'push-up').map((e) => e.id)).toEqual([
      'incline-push-up', 'push-up', 'diamond-push-up', 'decline-push-up', 'pseudo-planche-push-up', 'archer-push-up', 'one-arm-push-up-elevated', 'one-arm-push-up',
    ]);
    expect(chainFor(lib, 'front-lever').map((e) => e.id)).toEqual(['tuck-front-lever', 'advanced-tuck-front-lever', 'one-leg-front-lever', 'straddle-front-lever', 'front-lever']);
    expect(chainFor(lib, 'planche-lean').map((e) => e.id)).toEqual(['planche-lean', 'tuck-planche', 'advanced-tuck-planche', 'straddle-planche']);
    expect(chainFor(lib, 'bar-muscle-up').length).toBe(5);
    expect(chainFor(lib, 'pistol-squat').map((e) => e.id)).toEqual(['bodyweight-squat', 'split-squat', 'bulgarian-split-squat-bw', 'assisted-pistol-squat', 'pistol-squat', 'shrimp-squat', 'elevated-pistol-squat']);
    expect(chainFor(lib, 'nordic-curl').map((e) => e.id)).toEqual(['sliding-leg-curl', 'single-leg-sliding-leg-curl', 'nordic-negative', 'nordic-curl', 'nordic-curl-overhead']);
    expect(chainFor(lib, 'prone-y-raise')).toEqual([]);
  });
});

describe('resolveVariation', () => {
  const slot = { exerciseId: 'push-up' };

  it('starts on the slot rung with no history', () => {
    expect(resolveVariation([], lib, slot)).toMatchObject({ exerciseId: 'push-up', basis: 'start', level: 1, levelCount: 8, progressionId: 'push' });
  });

  it('returns null for non-chain exercises and locked slots', () => {
    expect(resolveVariation([], lib, { exerciseId: 'prone-y-raise' })).toBeNull();
    expect(resolveVariation([], lib, { exerciseId: 'push-up', lockVariation: true })).toBeNull();
  });

  it('advances after a ceiling exposure, holds otherwise', () => {
    const inc = [ws([es('push-up', [12, 12, 12])])];
    expect(resolveVariation(inc, lib, slot)).toMatchObject({ exerciseId: 'diamond-push-up', basis: 'advance', fromExerciseId: 'push-up', level: 2 });
    const hold = [ws([es('push-up', [12, 12, 11])])];
    expect(resolveVariation(hold, lib, slot)).toMatchObject({ exerciseId: 'push-up', basis: 'hold' });
    expect(resolveVariation(hold, lib, slot)?.fromExerciseId).toBeUndefined();
  });

  it('a deload exposure at the ceiling never advances', () => {
    const dl = [ws([es('push-up', [12, 12, 12], { deload: true })])];
    expect(resolveVariation(dl, lib, slot)).toMatchObject({ exerciseId: 'push-up', basis: 'hold' });
  });

  it('follows the most recent rung actually performed, even when it is not the slot rung', () => {
    const sessions = [ws([es('push-up', [12, 12, 12])]), ws([es('archer-push-up', [9, 8, 8])], '2026-09-03')];
    expect(resolveVariation(sessions, lib, slot)).toMatchObject({ exerciseId: 'archer-push-up', basis: 'hold', level: 5 });
  });

  it('regresses only after two consecutive below-range exposures on the same rung and load', () => {
    const one = [ws([es('diamond-push-up', [7, 6, 6])])];
    expect(resolveVariation(one, lib, slot)).toMatchObject({ exerciseId: 'diamond-push-up', basis: 'hold' });
    const two = [...one, ws([es('diamond-push-up', [7, 6, 5])], '2026-09-03')];
    expect(resolveVariation(two, lib, slot)).toMatchObject({ exerciseId: 'push-up', basis: 'regress', fromExerciseId: 'diamond-push-up' });
    const reset = [...one, ws([es('diamond-push-up', [9, 9, 8])], '2026-09-02'), ws([es('diamond-push-up', [7, 6, 5])], '2026-09-03')];
    expect(resolveVariation(reset, lib, slot)).toMatchObject({ exerciseId: 'diamond-push-up', basis: 'hold' });
    const incomplete = [...one, ws([es('diamond-push-up', [7, 6])], '2026-09-03')];
    expect(resolveVariation(incomplete, lib, slot)).toMatchObject({ exerciseId: 'diamond-push-up', basis: 'hold' });
    const bottom = [ws([es('incline-push-up', [5, 5, 5])]), ws([es('incline-push-up', [5, 5, 5])], '2026-09-03')];
    expect(resolveVariation(bottom, lib, slot)).toMatchObject({ exerciseId: 'incline-push-up', basis: 'hold' });
  });

  it('reports TOP when the last rung hits the ceiling', () => {
    const top = [ws([es('one-arm-push-up', [12, 12, 12])])];
    expect(resolveVariation(top, lib, slot)).toMatchObject({ exerciseId: 'one-arm-push-up', basis: 'top', level: 7 });
  });

  it('respects the `before` cutoff and ignores active sessions', () => {
    const a = ws([es('push-up', [12, 12, 12])]);
    const active: WorkoutSession = { ...ws([es('diamond-push-up', [12, 12, 12])], '2026-09-03'), status: 'active' };
    expect(resolveVariation([a, active], lib, slot)).toMatchObject({ exerciseId: 'diamond-push-up', basis: 'advance' });
    expect(resolveVariation([a], lib, slot, a.startedAt)).toMatchObject({ basis: 'start' });
    expect(lastChainPerformance([a, active], ['push-up', 'diamond-push-up'])?.es.exerciseId).toBe('push-up');
  });
});

describe('helpers', () => {
  it('adjacentVariation walks the chain and stops at the ends', () => {
    expect(adjacentVariation(lib, 'push-up', 1)?.id).toBe('diamond-push-up');
    expect(adjacentVariation(lib, 'push-up', -1)?.id).toBe('incline-push-up');
    expect(adjacentVariation(lib, 'incline-push-up', -1)).toBeNull();
    expect(adjacentVariation(lib, 'one-arm-push-up', 1)).toBeNull();
    expect(adjacentVariation(lib, 'prone-y-raise', 1)).toBeNull();
  });

  it('labels read as variation moves, never as failures', () => {
    expect(chainResultText('increase', { level: 2, levelCount: 8 })).toMatchObject({ text: 'Advance' });
    expect(chainResultText('increase', { level: 8, levelCount: 9 })).toMatchObject({ text: 'Top of chain' });
    expect(chainResultText('reduce', { level: 2, levelCount: 8 })).toMatchObject({ text: 'Step back' });
    expect(chainResultText('hold', { level: 2, levelCount: 8 }).text).toBe('Hold');
    expect(chainResultText('hold', { level: 2, levelCount: 8, deload: true }).text).toBe('Deload');
    expect(basisText({ variationBasis: 'advance', fromName: 'Push-up' })?.text).toContain('Push-up');
    expect(basisText({ variationBasis: 'regress', fromName: 'Archer push-up' })?.text).toContain('your call');
    expect(basisText({ variationBasis: 'top' })?.text).toContain('add load');
    for (const b of ['start', 'hold', 'manual'] as const) expect(basisText({ variationBasis: b })?.text).toBeTruthy();
  });
});
