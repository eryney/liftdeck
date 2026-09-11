import { describe, expect, it } from 'vitest';
import { epley, exposureE1RM, strengthTrend, systemLoadHistory } from '../src/lib/strength';
import type { ExerciseSession, WorkoutSession } from '../src/types';

let n = 0;
function sess(date: string, weight: number, reps: number[], extra: Partial<ExerciseSession> = {}): WorkoutSession {
  const startedAt = new Date(`${date}T18:00:00`).getTime();
  const es: ExerciseSession = {
    id: `es${++n}`, exerciseId: 'db-bench-press', name: 'DB Bench', targetSets: reps.length, repMin: 6, repMax: 10, restSec: 150,
    increment: 2.5, suggestedWeight: weight, weight, sets: reps.map((r) => ({ reps: r, weight })), ...extra,
  };
  return { id: `ws${n}`, date, name: 'B', status: 'completed', startedAt, exercises: [es] };
}
const days = (i: number) => `2026-0${i < 10 ? 8 : 9}-${String(i < 10 ? 20 + i : i - 9).padStart(2, '0')}`;

describe('estimated 1RM', () => {
  it('Epley on 1–12 rep sets only; labelled as estimated', () => {
    expect(epley(100, 10)).toBeCloseTo(133.3, 1);
    expect(exposureE1RM([{ reps: 10, weight: 100 }, { reps: 20, weight: 100 }])).toBeCloseTo(133.3, 1);
    expect(exposureE1RM([{ reps: 20, weight: 100 }])).toBeNull(); // very high reps excluded
    expect(exposureE1RM([{ reps: 0, weight: 100 }, { reps: null, weight: 100 }])).toBeNull();
    expect(exposureE1RM([{ reps: 8, weight: 0 }])).toBeNull(); // bodyweight-only without system load
  });
});

describe('strength maintenance trend', () => {
  it('needs a baseline before labelling', () => {
    const t = strengthTrend([sess(days(1), 50, [10, 10, 10]), sess(days(3), 52.5, [8, 8, 8])], 'db-bench-press');
    expect(t.label).toBe('baseline');
    expect(t.points).toHaveLength(2);
  });

  it('MAINTAINED when the rolling mean holds within ±2.5%', () => {
    const s = [1, 2, 3, 4, 5, 6].map((i) => sess(days(i), 50, [9, 9, 9]));
    expect(strengthTrend(s, 'db-bench-press').label).toBe('maintained');
  });

  it('IMPROVING when the recent 3 beat the prior 3', () => {
    const s = [sess(days(1), 50, [8, 8, 8]), sess(days(2), 50, [9, 9, 9]), sess(days(3), 50, [10, 10, 10]), sess(days(4), 52.5, [10, 10, 10]), sess(days(5), 55, [10, 10, 10]), sess(days(6), 57.5, [9, 9, 9])];
    expect(strengthTrend(s, 'db-bench-press').label).toBe('improving');
  });

  it('a single bad session is NOT trending down; a persistent decline is', () => {
    const good = [1, 2, 3, 4, 5].map((i) => sess(days(i), 50, [10, 10, 10]));
    const oneBad = [...good, sess(days(6), 50, [6, 6, 5])];
    expect(strengthTrend(oneBad, 'db-bench-press').label).toBe('maintained');
    const persistent = [...good.slice(0, 3), sess(days(4), 50, [7, 6, 6]), sess(days(5), 50, [6, 6, 6]), sess(days(6), 50, [6, 6, 5])];
    expect(strengthTrend(persistent, 'db-bench-press').label).toBe('down');
  });

  it('never claims muscle gained or lost', () => {
    const s = [1, 2, 3, 4, 5, 6].map((i) => sess(days(i), 50, [6, 6, 6]));
    const t = strengthTrend(s, 'db-bench-press');
    expect(JSON.stringify(t)).not.toMatch(/muscle/i);
  });

  it('bodyweight lifts use total system load only when a body weight is near the date', () => {
    const pull = (d: string, added: number) => sess(d, added, [8, 8, 8], { exerciseId: 'pull-up', bodyweight: true });
    const s = [pull('2026-08-21', 0), pull('2026-08-24', 2.5)];
    expect(strengthTrend(s, 'pull-up', []).points).toHaveLength(0); // no bodyweight → omitted
    const ms = [{ id: 'm', date: '2026-08-22', weightLb: 180, loggedAt: 1 }];
    const t = strengthTrend(s, 'pull-up', ms);
    expect(t.systemLoad).toBe(true);
    expect(t.points[0].value).toBeCloseTo(epley(180, 8), 0);
    expect(systemLoadHistory(s, 'pull-up', ms)).toEqual([
      { date: '2026-08-21', added: 0, bodyweight: 180, total: 180 },
      { date: '2026-08-24', added: 2.5, bodyweight: 180, total: 182.5 },
    ]);
  });
});
