import { describe, expect, it } from 'vitest';
import { boxingLastWeeks, boxingLoad, boxingTimestamp, boxingWeekStats, hardBoxingWithin, isHardBoxing } from '../src/lib/boxing';
import { boxingToCSV } from '../src/lib/backup';
import type { BoxingAttendance } from '../src/types';

const b = (date: string, extra: Partial<BoxingAttendance> = {}): BoxingAttendance => ({ id: `b-${date}-${Math.random()}`, date, loggedAt: new Date(`${date}T19:00:00`).getTime(), ...extra });

describe('boxing load', () => {
  it('is only calculated when both duration and RPE exist', () => {
    expect(boxingLoad({ durationMin: 60, rpe: 7 })).toBe(420);
    expect(boxingLoad({ durationMin: 60 })).toBeNull();
    expect(boxingLoad({ rpe: 7 })).toBeNull();
    expect(boxingLoad({})).toBeNull();
    expect(boxingLoad({ durationMin: 0, rpe: 7 })).toBeNull();
  });

  it('weekly stats keep minutes/load null when no metadata exists, and never rank weeks', () => {
    const empty = boxingWeekStats([b('2026-08-31'), b('2026-09-02')], '2026-08-31');
    expect(empty).toMatchObject({ count: 2, minutes: null, load: null, types: {} });
    const rich = boxingWeekStats([b('2026-08-31', { durationMin: 60, rpe: 6, sessionType: 'bag' }), b('2026-09-02', { durationMin: 45 }), b('2026-09-07')], '2026-08-31');
    expect(rich).toMatchObject({ count: 2, minutes: 105, load: 360, types: { bag: 1 } });
    expect(Object.keys(rich)).not.toContain('score');
  });

  it('last 8 weeks are ordered oldest first ending with the current week', () => {
    const weeks = boxingLastWeeks([b('2026-08-31'), b('2026-08-24')], '2026-09-03', 8);
    expect(weeks).toHaveLength(8);
    expect(weeks[7].weekStart).toBe('2026-08-31');
    expect(weeks[7].count).toBe(1);
    expect(weeks[6].count).toBe(1);
  });
});

describe('hard boxing', () => {
  it('RPE ≥ 8 or meaningful sparring', () => {
    expect(isHardBoxing(b('2026-09-01', { rpe: 8 }))).toBe(true);
    expect(isHardBoxing(b('2026-09-01', { rpe: 7 }))).toBe(false);
    expect(isHardBoxing(b('2026-09-01', { sessionType: 'sparring', durationMin: 40 }))).toBe(true);
    expect(isHardBoxing(b('2026-09-01', { sessionType: 'sparring' }))).toBe(false);
    expect(isHardBoxing(b('2026-09-01'))).toBe(false);
  });

  it('within 24h uses the log time when logged the same day, else midday', () => {
    const same = b('2026-09-01', { rpe: 9 }); // 19:00
    expect(boxingTimestamp(same)).toBe(new Date('2026-09-01T19:00:00').getTime());
    const backfilled = { ...b('2026-09-01', { rpe: 9 }), loggedAt: new Date('2026-09-03T08:00:00').getTime() };
    expect(boxingTimestamp(backfilled)).toBe(new Date('2026-09-01T12:00:00').getTime());
    expect(hardBoxingWithin([same], new Date('2026-09-02T10:00:00').getTime())).toBe(same);
    expect(hardBoxingWithin([same], new Date('2026-09-03T10:00:00').getTime())).toBeNull();
  });
});

describe('boxing CSV', () => {
  it('includes optional metadata and accepts missing fields', () => {
    const csv = boxingToCSV([b('2026-09-02'), b('2026-09-01', { sessionType: 'sparring', durationMin: 60, rpe: 8 })]);
    expect(csv.split('\n')).toEqual([
      'date,session_type,duration_min,rpe,load',
      '2026-09-01,sparring,60,8,480',
      '2026-09-02,,,,',
    ]);
  });
});
