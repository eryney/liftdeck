import { describe, expect, it } from 'vitest';
import {
  assess, assessWithHistory, belowRange, bestSet, computeResult, exerciseSucceeded, isComplete, resultLabel, suggestWeight,
} from '../src/lib/progression';
import type { ExerciseSession, WorkoutSession } from '../src/types';

function es(over: Partial<ExerciseSession>): ExerciseSession {
  return {
    id: 'es1',
    exerciseId: 'db-bench-press',
    name: 'DB Bench',
    targetSets: 3,
    repMin: 6,
    repMax: 10,
    restSec: 150,
    increment: 2.5,
    suggestedWeight: 50,
    weight: 50,
    sets: [],
    ...over,
  };
}

const at = (reps: (number | null)[], weight = 50) => reps.map((r) => ({ reps: r, weight }));

function session(over: Partial<WorkoutSession>): WorkoutSession {
  return { id: 'ws1', date: '2026-08-25', name: 'STRENGTH B', status: 'completed', startedAt: 1000, exercises: [], ...over };
}

describe('double progression: assess', () => {
  it('INCREASE when every prescribed set reaches repMax', () => {
    expect(assess(es({ sets: at([10, 10, 10]) }))).toBe('increase');
    expect(exerciseSucceeded(es({ sets: at([10, 10, 11]) }))).toBe(true);
  });

  it('HOLD on partial upper-range completion (10/10/9)', () => {
    expect(assess(es({ sets: at([10, 10, 9]) }))).toBe('hold');
    expect(assess(es({ sets: at([9, 8, 8]) }))).toBe('hold');
  });

  it('HOLD (not reduce) on a first below-range exposure', () => {
    const e = es({ sets: at([6, 5, 5]) });
    expect(assess(e)).toBe('hold');
    expect(belowRange(e)).toBe(true);
    expect(assessWithHistory(e, null)).toBe('hold');
  });

  it('INCOMPLETE when fewer than the prescribed sets were logged', () => {
    expect(assess(es({ sets: at([10, 10, null]) }))).toBe('incomplete');
    expect(isComplete(es({ sets: at([10, 10]) }))).toBe(false);
  });

  it('extra sets never affect the decision', () => {
    // prescribed 3 all at repMax, a 4th bonus set at 5 → still INCREASE
    expect(assess(es({ sets: at([10, 10, 10, 5]) }))).toBe('increase');
    // prescribed sets short, extra set huge → still HOLD
    expect(assess(es({ sets: at([10, 10, 9, 15]) }))).toBe('hold');
    // a below-range EXTRA set never contributes to REDUCE
    const cur = es({ sets: at([8, 8, 8, 3]) });
    const prior = es({ sets: at([8, 8, 8, 2]) });
    expect(belowRange(cur)).toBe(false);
    expect(assessWithHistory(cur, prior)).toBe('hold');
  });
});

describe('double progression: REDUCE', () => {
  const below = () => es({ sets: at([6, 5, 4]) });

  it('second consecutive below-range exposure at the same load → reduce', () => {
    expect(assessWithHistory(below(), below())).toBe('reduce');
  });

  it('a successful (or hold) exposure in between resets the streak', () => {
    // history: below, then a clean hold, then below → only one consecutive below → hold
    const prior = es({ sets: at([8, 8, 8]) });
    expect(assessWithHistory(below(), prior)).toBe('hold');
    const priorInc = es({ sets: at([10, 10, 10]) });
    expect(assessWithHistory(below(), priorInc)).toBe('hold');
  });

  it('a load change resets same-load failure logic', () => {
    const priorHeavier = es({ weight: 55, sets: at([6, 5, 4], 55) });
    expect(assessWithHistory(below(), priorHeavier)).toBe('hold');
  });

  it('an incomplete prior exposure never counts toward reduction', () => {
    const priorIncomplete = es({ sets: at([5, 4, null]) });
    expect(assessWithHistory(below(), priorIncomplete)).toBe('hold');
    // and an incomplete current exposure is never reduced
    expect(assessWithHistory(es({ sets: at([4, null, null]) }), below())).toBe('incomplete');
  });

  it('computeResult looks up the prior exposure from history (ignores the session itself)', () => {
    const s1 = session({ id: 'a', startedAt: 1, exercises: [below()] });
    const s2 = session({ id: 'b', startedAt: 2, exercises: [below()] });
    expect(computeResult(s2.exercises[0], [s1, s2], s2)).toBe('reduce');
    // first exposure ever → hold
    expect(computeResult(s1.exercises[0], [s1, s2], s1)).toBe('hold');
  });
});

describe('suggestWeight', () => {
  const tpl = { increment: 2.5, startWeight: 40 };

  it('uses startWeight with no history', () => {
    expect(suggestWeight([], 'db-bench-press', tpl)).toMatchObject({ weight: 40, basis: 'start' });
  });

  it('adds the slot increment after INCREASE', () => {
    const s = session({ exercises: [es({ sets: at([10, 10, 10]) })] });
    expect(suggestWeight([s], 'db-bench-press', tpl)).toMatchObject({ weight: 52.5, basis: 'increase', fromProgress: true });
  });

  it('holds after a partial workout', () => {
    const s = session({ exercises: [es({ sets: at([10, 10, 9]) })] });
    expect(suggestWeight([s], 'db-bench-press', tpl)).toMatchObject({ weight: 50, basis: 'hold' });
  });

  it('holds after an incomplete (finish-early) exposure — never reduces', () => {
    const prior = session({ id: 'p', startedAt: 1, exercises: [es({ sets: at([6, 5, 4]) })] });
    const s = session({ id: 'q', startedAt: 2, exercises: [es({ sets: at([5, null, null]) })] });
    expect(suggestWeight([prior, s], 'db-bench-press', tpl)).toMatchObject({ weight: 50, basis: 'incomplete' });
  });

  it('suggests one increment lower after two consecutive below-range exposures at the same load', () => {
    const s1 = session({ id: 'a', startedAt: 1, exercises: [es({ sets: at([6, 5, 4]) })] });
    const s2 = session({ id: 'b', startedAt: 2, exercises: [es({ sets: at([6, 5, 5]) })] });
    expect(suggestWeight([s1, s2], 'db-bench-press', tpl)).toMatchObject({ weight: 47.5, basis: 'reduce' });
  });

  it('respects a manual override: suggestion derives from the load actually used', () => {
    const s = session({ exercises: [es({ suggestedWeight: 50, weight: 40, sets: at([10, 10, 10], 40) })] });
    expect(suggestWeight([s], 'db-bench-press', tpl).weight).toBe(42.5);
  });

  it('respects ignoring a reduce suggestion (same weight used again → evaluated fresh)', () => {
    const s1 = session({ id: 'a', startedAt: 1, exercises: [es({ sets: at([6, 5, 4]) })] });
    const s2 = session({ id: 'b', startedAt: 2, exercises: [es({ sets: at([6, 5, 5]) })] });
    // user ignored the 47.5 suggestion, lifted 50 again and hit the range
    const s3 = session({ id: 'c', startedAt: 3, exercises: [es({ suggestedWeight: 47.5, weight: 50, sets: at([8, 7, 6]) })] });
    expect(suggestWeight([s1, s2, s3], 'db-bench-press', tpl)).toMatchObject({ weight: 50, basis: 'hold' });
  });

  it('uses the most recent session, not the best one', () => {
    const older = session({ id: 'a', startedAt: 1, exercises: [es({ weight: 55, sets: at([10, 10, 10], 55) })] });
    const newer = session({ id: 'b', startedAt: 2, exercises: [es({ weight: 50, sets: at([8, 7, 6]) })] });
    expect(suggestWeight([older, newer], 'db-bench-press', tpl).weight).toBe(50);
  });

  it('ignores active (unfinished) sessions', () => {
    const active = session({ status: 'active', exercises: [es({ weight: 60, sets: at([10], 60) })] });
    expect(suggestWeight([active], 'db-bench-press', tpl).weight).toBe(40);
  });

  it('never goes below zero when reducing', () => {
    const s1 = session({ id: 'a', startedAt: 1, exercises: [es({ exerciseId: 'pull-up', weight: 0, bodyweight: true, sets: at([3, 3, 3], 0) })] });
    const s2 = session({ id: 'b', startedAt: 2, exercises: [es({ exerciseId: 'pull-up', weight: 0, bodyweight: true, sets: at([3, 2, 2], 0) })] });
    expect(suggestWeight([s1, s2], 'pull-up', { increment: 2.5, startWeight: 0 }).weight).toBe(0);
  });

  it('substitutes use their own history, never the original exercise load', () => {
    const bench = session({ id: 'a', startedAt: 1, exercises: [es({ sets: at([10, 10, 10]) })] });
    // push-up has no history → its template start weight, not bench's 52.5
    expect(suggestWeight([bench], 'push-up', { increment: 2.5, startWeight: 0 }).weight).toBe(0);
    const pushups = session({ id: 'b', startedAt: 2, exercises: [es({ exerciseId: 'push-up', bodyweight: true, weight: 10, sets: at([10, 10, 10], 10) })] });
    expect(suggestWeight([bench, pushups], 'push-up', { increment: 2.5, startWeight: 0 }).weight).toBe(12.5);
  });
});

describe('RIR is optional telemetry', () => {
  it('omission or presence never changes the assessment', () => {
    const a = es({ sets: at([10, 10, 10]) });
    const b = es({ sets: at([10, 10, 10]), finalSetRir: 0 });
    const c = es({ sets: at([6, 5, 4]), finalSetRir: 3 });
    expect(assess(a)).toBe(assess(b));
    expect(assess(c)).toBe('hold');
    expect(assessWithHistory(c, es({ sets: at([6, 5, 4]), finalSetRir: 0 }))).toBe('reduce');
  });
});

describe('labels', () => {
  it('maps v1 results to v2 language', () => {
    expect(resultLabel('progress').text).toBe('Increase');
    expect(resultLabel('keep').text).toBe('Hold');
    expect(resultLabel('reduce').cls).toBe('amber'); // never red
    expect(resultLabel('hold').text).toBe('Hold');
    expect(resultLabel(undefined).text).toBe('');
  });
});

describe('bestSet', () => {
  it('prefers heavier weight, then more reps', () => {
    const s1 = session({ id: 'a', exercises: [es({ sets: [{ reps: 12, weight: 45 }] })] });
    const s2 = session({ id: 'b', date: '2026-08-27', exercises: [es({ sets: [{ reps: 8, weight: 50 }, { reps: 10, weight: 50 }] })] });
    expect(bestSet([s1, s2], 'db-bench-press')).toEqual({ weight: 50, reps: 10, date: '2026-08-27' });
  });
});
