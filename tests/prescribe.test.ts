import { describe, expect, it } from 'vitest';
import { fmtTargets, hitAllTargets, prescribeReps } from '../src/lib/prescribe';

const last = (reps: (number | null)[], targetReps?: number[], repMin = 8, deload?: boolean) => ({
  sets: reps.map((r) => ({ reps: r, weight: 0 })),
  targetSets: 3,
  targetReps,
  repMin,
  ...(deload ? { deload: true } : {}),
});

describe('prescribeReps', () => {
  it('a fresh rung starts at the floor on every set', () => {
    expect(prescribeReps({ sets: 3, repMin: 8, repMax: 12 })).toEqual([8, 8, 8]);
    expect(prescribeReps({ sets: 3, repMin: 15, repMax: 30, timed: true, last: null })).toEqual([15, 15, 15]);
  });

  it('every target hit → +1 on every set; otherwise +1 in total, front-loaded', () => {
    expect(prescribeReps({ sets: 3, repMin: 8, repMax: 12, last: last([8, 8, 8], [8, 8, 8]) })).toEqual([9, 9, 9]);
    expect(prescribeReps({ sets: 3, repMin: 8, repMax: 12, last: last([9, 9, 8], [9, 9, 9]) })).toEqual([9, 9, 9]);
    expect(prescribeReps({ sets: 3, repMin: 8, repMax: 12, last: last([10, 9, 9], [10, 10, 10]) })).toEqual([10, 10, 9]);
  });

  it('never prescribes below the floor or above the ceiling', () => {
    expect(prescribeReps({ sets: 3, repMin: 8, repMax: 12, last: last([6, 5, 4], [8, 8, 8]) })).toEqual([8, 8, 8]);
    expect(prescribeReps({ sets: 3, repMin: 8, repMax: 12, last: last([12, 12, 11], [12, 12, 12]) })).toEqual([12, 12, 12]);
    expect(prescribeReps({ sets: 3, repMin: 8, repMax: 12, last: last([12, 12, 12], [12, 12, 12]) })).toEqual([12, 12, 12]);
  });

  it('sessions without targets treat the floor as the target; incomplete sets use the last logged value', () => {
    expect(prescribeReps({ sets: 3, repMin: 8, repMax: 12, last: last([10, 10, 10]) })).toEqual([11, 11, 11]);
    expect(prescribeReps({ sets: 3, repMin: 8, repMax: 12, last: last([10, 7, 7]) })).toEqual([10, 8, 8]);
    expect(prescribeReps({ sets: 3, repMin: 8, repMax: 12, last: last([9, null, null], [9, 9, 9]) })).toEqual([10, 10, 10]);
  });

  it('over-performing feeds the next target from what was actually done', () => {
    expect(prescribeReps({ sets: 3, repMin: 5, repMax: 8, last: last([8, 7, 6], [5, 5, 5], 5) })).toEqual([8, 8, 7]);
  });

  it('after a deload the climb restarts one step above the floor, whatever was done that day', () => {
    expect(prescribeReps({ sets: 3, repMin: 5, repMax: 8, last: last([8, 8, 8], [5, 5, 5], 5, true) })).toEqual([6, 6, 6]);
    expect(prescribeReps({ sets: 3, repMin: 5, repMax: 8, last: last([5, 5, 5], [5, 5, 5], 5, true) })).toEqual([6, 6, 6]);
    expect(prescribeReps({ sets: 3, repMin: 15, repMax: 30, timed: true, last: last([15, 15, 15], [15, 15, 15], 15, true) })).toEqual([20, 20, 20]);
  });

  it('timed holds move in 5-second steps', () => {
    expect(prescribeReps({ sets: 3, repMin: 15, repMax: 30, timed: true, last: last([15, 15, 15], [15, 15, 15], 15) })).toEqual([20, 20, 20]);
    expect(prescribeReps({ sets: 3, repMin: 15, repMax: 30, timed: true, last: last([20, 20, 15], [20, 20, 20], 15) })).toEqual([20, 20, 20]);
    expect(prescribeReps({ sets: 2, repMin: 20, repMax: 40, timed: true, last: last([25, 20], [25, 25], 20) })).toEqual([25, 25]);
  });

  it('helpers', () => {
    expect(hitAllTargets({ sets: [{ reps: 9, weight: 0 }, { reps: 9, weight: 0 }, { reps: 8, weight: 0 }], targetSets: 3, targetReps: [9, 9, 9] })).toBe(false);
    expect(hitAllTargets({ sets: [{ reps: 9, weight: 0 }, { reps: 10, weight: 0 }, { reps: 9, weight: 0 }, { reps: 2, weight: 0 }], targetSets: 3, targetReps: [9, 9, 9] })).toBe(true);
    expect(hitAllTargets({ sets: [{ reps: 9, weight: 0 }], targetSets: 1 })).toBe(false);
    expect(fmtTargets([9, 9, 8])).toBe('9 · 9 · 8');
    expect(fmtTargets([20, 20], true)).toBe('20s · 20s');
    expect(fmtTargets(undefined)).toBe('');
  });
});
