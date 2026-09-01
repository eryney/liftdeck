import { describe, expect, it } from 'vitest';
import { exerciseSucceeded, movingAverage, suggestWeight, bestSet } from '../src/lib/progression';
import type { ExerciseSession, WorkoutSession } from '../src/types';

function es(over: Partial<ExerciseSession>): ExerciseSession {
  return {
    id: 'es1',
    exerciseId: 'db-incline-press',
    name: 'Incline Press',
    targetSets: 3,
    repMin: 8,
    repMax: 15,
    restSec: 120,
    increment: 5,
    suggestedWeight: 45,
    weight: 45,
    sets: [],
    ...over,
  };
}

function session(over: Partial<WorkoutSession>): WorkoutSession {
  return {
    id: 'ws1',
    date: '2026-08-25',
    name: 'STRENGTH A',
    status: 'completed',
    startedAt: 1000,
    exercises: [],
    ...over,
  };
}

describe('exerciseSucceeded', () => {
  it('succeeds when all prescribed sets hit the top of the range', () => {
    const e = es({ sets: [15, 15, 15].map((r) => ({ reps: r, weight: 45 })) });
    expect(exerciseSucceeded(e)).toBe(true);
  });

  it('fails when any set is below the top', () => {
    const e = es({ sets: [15, 13, 11].map((r) => ({ reps: r, weight: 45 })) });
    expect(exerciseSucceeded(e)).toBe(false);
  });

  it('fails when fewer than the prescribed sets were logged', () => {
    const e = es({ sets: [{ reps: 15, weight: 45 }, { reps: 15, weight: 45 }, { reps: null, weight: 45 }] });
    expect(exerciseSucceeded(e)).toBe(false);
  });

  it('extra sets above target must also hit the top', () => {
    const e = es({ sets: [15, 15, 15, 9].map((r) => ({ reps: r, weight: 45 })) });
    expect(exerciseSucceeded(e)).toBe(false);
  });
});

describe('suggestWeight', () => {
  const tpl = { increment: 5, startWeight: 35 };

  it('uses startWeight with no history', () => {
    expect(suggestWeight([], 'db-incline-press', tpl)).toEqual({ weight: 35, fromProgress: false });
  });

  it('adds increment after a full success', () => {
    const s = session({ exercises: [es({ sets: [15, 15, 15].map((r) => ({ reps: r, weight: 45 })) })] });
    expect(suggestWeight([s], 'db-incline-press', tpl)).toEqual({ weight: 50, fromProgress: true });
  });

  it('keeps the weight after a partial workout', () => {
    const s = session({ exercises: [es({ sets: [15, 13, 11].map((r) => ({ reps: r, weight: 45 })) })] });
    expect(suggestWeight([s], 'db-incline-press', tpl)).toEqual({ weight: 45, fromProgress: false });
  });

  it('respects a manual override in the last session', () => {
    const s = session({
      exercises: [es({ weight: 40, sets: [15, 15, 15].map((r) => ({ reps: r, weight: 40 })) })],
    });
    expect(suggestWeight([s], 'db-incline-press', tpl).weight).toBe(45);
  });

  it('uses the most recent session, not the best one', () => {
    const older = session({
      id: 'a',
      startedAt: 1,
      exercises: [es({ weight: 50, sets: [15, 15, 15].map((r) => ({ reps: r, weight: 50 })) })],
    });
    const newer = session({
      id: 'b',
      startedAt: 2,
      exercises: [es({ weight: 45, sets: [12, 10, 8].map((r) => ({ reps: r, weight: 45 })) })],
    });
    expect(suggestWeight([older, newer], 'db-incline-press', tpl).weight).toBe(45);
  });

  it('ignores active (unfinished) sessions', () => {
    const active = session({ status: 'active', exercises: [es({ weight: 60, sets: [{ reps: 15, weight: 60 }] })] });
    expect(suggestWeight([active], 'db-incline-press', tpl).weight).toBe(35);
  });
});

describe('bestSet', () => {
  it('prefers heavier weight, then more reps', () => {
    const s1 = session({ id: 'a', exercises: [es({ sets: [{ reps: 12, weight: 45 }] })] });
    const s2 = session({ id: 'b', date: '2026-08-27', exercises: [es({ sets: [{ reps: 8, weight: 50 }, { reps: 10, weight: 50 }] })] });
    expect(bestSet([s1, s2], 'db-incline-press')).toEqual({ weight: 50, reps: 10, date: '2026-08-27' });
  });
});

describe('movingAverage', () => {
  it('averages within the trailing window', () => {
    const pts = [
      { date: '2026-08-01', value: 180 },
      { date: '2026-08-02', value: 182 },
      { date: '2026-08-03', value: 181 },
    ];
    const ma = movingAverage(pts, 7);
    expect(ma[0].value).toBe(180);
    expect(ma[1].value).toBe(181);
    expect(ma[2].value).toBeCloseTo(181, 1);
  });

  it('drops points outside the window', () => {
    const pts = [
      { date: '2026-08-01', value: 100 },
      { date: '2026-08-20', value: 200 },
    ];
    const ma = movingAverage(pts, 7);
    expect(ma[1].value).toBe(200);
  });
});
