import { describe, expect, it } from 'vitest';
import { currentStreak, dayInfo, periodStats, weekPlanStats } from '../src/lib/adherence';
import type { AdherenceContext } from '../src/lib/adherence';
import type { WorkoutPlan, WorkoutSession } from '../src/types';

// 2026-08-31 is a Monday
const MON = '2026-08-31';
const TUE = '2026-09-01';
const WED = '2026-09-02';
const THU = '2026-09-03';
const FRI = '2026-09-04';

const plan: WorkoutPlan = {
  id: 'p',
  name: 'TEST',
  schedule: [
    { type: 'boxing' }, // Mon
    { type: 'workout', templateId: 'A' }, // Tue
    { type: 'boxing' }, // Wed
    { type: 'workout', templateId: 'B' }, // Thu
    { type: 'workout', templateId: 'X', optional: true }, // Fri
    { type: 'boxing' }, // Sat
    { type: 'boxing' }, // Sun
  ],
};

function ws(date: string): WorkoutSession {
  return { id: `ws-${date}`, date, name: 'A', status: 'completed', startedAt: 1, exercises: [] };
}

function ctx(over: Partial<AdherenceContext>): AdherenceContext {
  return { plan, sessions: [], boxing: [], startDate: MON, today: THU, ...over };
}

describe('dayInfo', () => {
  it('marks completed boxing', () => {
    const c = ctx({ boxing: [{ id: 'b', date: MON, loggedAt: 1 }] });
    expect(dayInfo(MON, c).status).toBe('completed');
  });

  it('marks missed required past days', () => {
    expect(dayInfo(MON, ctx({})).status).toBe('missed');
  });

  it('marks today as upcoming, not missed', () => {
    expect(dayInfo(THU, ctx({})).status).toBe('upcoming');
  });

  it('optional skipped is not a failure', () => {
    expect(dayInfo(FRI, ctx({ today: '2026-09-06' })).status).toBe('optional-skipped');
  });

  it('does not count days before startDate', () => {
    expect(dayInfo(MON, ctx({ startDate: WED })).status).toBe('before-start');
  });

  it('completed workout day', () => {
    const c = ctx({ sessions: [ws(TUE)] });
    expect(dayInfo(TUE, c).status).toBe('completed');
  });
});

describe('periodStats', () => {
  it('counts required and completed up to today', () => {
    const c = ctx({
      boxing: [
        { id: '1', date: MON, loggedAt: 1 },
        { id: '2', date: WED, loggedAt: 1 },
      ],
      sessions: [ws(TUE)],
      today: FRI,
    });
    const stats = periodStats(MON, '2026-09-06', c);
    // Mon..Fri elapsed: Mon(box ✓) Tue(A ✓) Wed(box ✓) Thu(B ✗) Fri(optional, excluded)
    expect(stats.required).toBe(4);
    expect(stats.completed).toBe(3);
  });
});

describe('weekPlanStats', () => {
  it('reports full week planned count regardless of today', () => {
    const c = ctx({ boxing: [{ id: '1', date: MON, loggedAt: 1 }], today: TUE });
    const stats = weekPlanStats(c, TUE);
    expect(stats.planned).toBe(6); // 4 boxing + 2 strength; optional Friday excluded
    expect(stats.completed).toBe(1);
  });
});

describe('currentStreak', () => {
  it('counts consecutive completions and ignores rest/optional days', () => {
    const c = ctx({
      boxing: [
        { id: '1', date: MON, loggedAt: 1 },
        { id: '2', date: WED, loggedAt: 1 },
      ],
      sessions: [ws(TUE)],
      today: THU,
    });
    expect(currentStreak(c, THU)).toBe(3); // Thu not done yet doesn't break it
  });

  it('breaks on a missed required day', () => {
    const c = ctx({
      boxing: [{ id: '2', date: WED, loggedAt: 1 }],
      sessions: [ws(TUE)],
      today: THU,
    });
    expect(currentStreak(c, THU)).toBe(2); // Mon missed stops the walk
  });
});
