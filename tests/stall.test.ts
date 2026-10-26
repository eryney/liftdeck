import { describe, expect, it } from 'vitest';
import { detectStall, rungWindow, STALL_SESSIONS } from '../src/lib/stall';
import type { ExerciseSession, WorkoutSession } from '../src/types';

function es(reps: (number | null)[], over: Partial<ExerciseSession> = {}): ExerciseSession {
  return {
    id: `es-${Math.random()}`,
    exerciseId: 'pull-up',
    name: 'Pull-up',
    bodyweight: true,
    targetSets: 3,
    repMin: 5,
    repMax: 8,
    restSec: 90,
    increment: 5,
    suggestedWeight: 0,
    weight: 0,
    sets: reps.map((r) => ({ reps: r, weight: over.weight ?? 0 })),
    ...over,
  };
}

let t = 1000;
function ws(e: ExerciseSession): WorkoutSession {
  t += 1000;
  return { id: `ws-${t}`, date: '2026-09-01', name: 'Upper A', status: 'completed', startedAt: t, exercises: [e] };
}

describe('detectStall', () => {
  it('needs STALL_SESSIONS complete exposures on the same rung and load', () => {
    expect(STALL_SESSIONS).toBe(3);
    const two = [ws(es([6, 6, 5])), ws(es([6, 6, 5]))];
    expect(detectStall(two, 'pull-up', 0)).toBeNull();
  });

  it('flags three sessions with no net progress; a climbing total is not a stall', () => {
    const flat = [ws(es([6, 6, 5])), ws(es([6, 6, 5])), ws(es([6, 6, 5]))];
    expect(detectStall(flat, 'pull-up', 0)).toEqual({ sessions: 3, from: 17, to: 17 });
    const dip = [ws(es([6, 6, 6])), ws(es([6, 6, 5])), ws(es([6, 5, 5]))];
    expect(detectStall(dip, 'pull-up', 0)).toMatchObject({ from: 18, to: 16 });
    const climb = [ws(es([6, 6, 5])), ws(es([6, 6, 6])), ws(es([7, 6, 6]))];
    expect(detectStall(climb, 'pull-up', 0)).toBeNull();
    // one bad session in the middle of a climb is not a stall either
    const wobble = [ws(es([6, 6, 5])), ws(es([5, 5, 5])), ws(es([6, 6, 6]))];
    expect(detectStall(wobble, 'pull-up', 0)).toBeNull();
  });

  it('a load change or a deload resets the window; incomplete exposures are skipped', () => {
    const flat = [ws(es([6, 6, 5])), ws(es([6, 6, 5])), ws(es([6, 6, 5]))];
    expect(detectStall([...flat, ws(es([5, 5, 5], { weight: 10 }))], 'pull-up', 10)).toBeNull();
    expect(detectStall([...flat, ws(es([5, 5, 5], { deload: true }))], 'pull-up', 0)).toBeNull();
    expect(detectStall([...flat, ws(es([5, 5, 5], { deload: true })), ws(es([6, 6, 6]))], 'pull-up', 0)).toBeNull();
    const withIncomplete = [ws(es([6, 6, 5])), ws(es([6, null, null])), ws(es([6, 6, 5])), ws(es([6, 6, 5]))];
    expect(rungWindow(withIncomplete, 'pull-up', 0)).toHaveLength(3);
    expect(detectStall(withIncomplete, 'pull-up', 0)).not.toBeNull();
  });

  it('respects the before cutoff and ignores other rungs', () => {
    const flat = [ws(es([6, 6, 5])), ws(es([6, 6, 5])), ws(es([6, 6, 5]))];
    expect(detectStall(flat, 'pull-up', 0, flat[2].startedAt)).toBeNull();
    expect(detectStall(flat, 'chin-up', 0)).toBeNull();
    const mixed = [ws(es([6, 6, 5])), ws(es([8, 8, 8], { exerciseId: 'archer-pull-up' })), ws(es([6, 6, 5])), ws(es([6, 6, 5]))];
    expect(detectStall(mixed, 'pull-up', 0)).not.toBeNull();
  });
});
