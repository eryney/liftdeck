import { describe, expect, it } from 'vitest';
import {
  dayRecord, foundationStreak, goalCount, isFixedPlan, isFlexPlan, nextRotationTemplateId, planMode, rotationLetter,
  sessionTag, targetWeeks, weekAttainment, weekSummaryLine,
} from '../src/lib/flex';
import { BOXER_CUT_PLAN, BC_TPL_A, BC_TPL_B, BC_TPL_OPT } from '../src/data/seedPlan';
import type { BoxingAttendance, WorkoutSession } from '../src/types';

// 2026-08-31 is a Monday
const MON = '2026-08-31';
const TUE = '2026-09-01';
const WED = '2026-09-02';
const THU = '2026-09-03';
const FRI = '2026-09-04';
const SAT = '2026-09-05';
const SUN = '2026-09-06';
const NEXT_MON = '2026-09-07';
const PREV_SUN = '2026-08-30';

let n = 0;
function ws(date: string, templateId: string, hour = 18): WorkoutSession {
  const startedAt = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();
  return { id: `ws-${++n}`, date, name: 'X', templateId, status: 'completed', startedAt, finishedAt: startedAt + 3600000, exercises: [] };
}
function box(date: string, extra: Partial<BoxingAttendance> = {}): BoxingAttendance {
  return { id: `bx-${++n}`, date, loggedAt: new Date(`${date}T19:00:00`).getTime(), ...extra };
}
const plan = BOXER_CUT_PLAN;

describe('plan mode', () => {
  it('records without mode are fixed plans', () => {
    const legacy = { id: 'p', name: 'OLD', schedule: [] } as any;
    expect(isFixedPlan(legacy)).toBe(true);
    expect(isFlexPlan(legacy)).toBe(false);
    expect(planMode(legacy)).toBe('fixed');
    expect(planMode(plan)).toBe('flex');
  });
});

describe('weekly attainment', () => {
  it('boxing on ANY day contributes; no weekday is ever "missed"', () => {
    const w = weekAttainment({ plan, sessions: [], boxing: [box(WED), box(SUN)] }, THU);
    const bg = w.goals.find((g) => g.goal.kind === 'boxing')!;
    expect(bg.count).toBe(2);
    expect(bg.minMet).toBe(true);
    expect(JSON.stringify(w)).not.toMatch(/missed/i);
  });

  it('2 boxing sessions meets the minimum, 4 meets the target', () => {
    const two = weekAttainment({ plan, sessions: [], boxing: [box(MON), box(TUE)] }, THU).goals[0];
    expect(two.minMet).toBe(true);
    expect(two.targetMet).toBe(false);
    const four = weekAttainment({ plan, sessions: [], boxing: [box(MON), box(TUE), box(FRI), box(SAT)] }, THU).goals[0];
    expect(four.targetMet).toBe(true);
  });

  it('1 strength session meets the minimum, 2 meets the target', () => {
    const one = weekAttainment({ plan, sessions: [ws(SAT, BC_TPL_A)], boxing: [] }, SAT).goals[1];
    expect(one.count).toBe(1);
    expect(one.minMet).toBe(true);
    expect(one.targetMet).toBe(false);
    const two = weekAttainment({ plan, sessions: [ws(TUE, BC_TPL_A), ws(FRI, BC_TPL_B)], boxing: [] }, SAT).goals[1];
    expect(two.targetMet).toBe(true);
  });

  it('a 3-boxing week with 1 strength is a FOUNDATION week, not a failure', () => {
    const w = weekAttainment({ plan, sessions: [ws(WED, BC_TPL_A)], boxing: [box(MON), box(THU), box(SAT)] }, SUN);
    expect(w.foundation).toBe(true);
    expect(w.target).toBe(false);
  });

  it('the ideal week hits TARGET', () => {
    const w = weekAttainment({ plan, sessions: [ws(TUE, BC_TPL_A), ws(FRI, BC_TPL_B)], boxing: [box(MON), box(WED), box(SAT), box(SUN)] }, SUN);
    expect(w.foundation).toBe(true);
    expect(w.target).toBe(true);
  });

  it('accessory work never affects adherence', () => {
    const acc = [ws(MON, BC_TPL_OPT), ws(WED, BC_TPL_OPT), ws(FRI, BC_TPL_OPT)];
    const w = weekAttainment({ plan, sessions: acc, boxing: [] }, SUN);
    expect(w.foundation).toBe(false);
    expect(w.target).toBe(false);
    expect(w.goals[1].count).toBe(0); // strength unaffected
    expect(w.goals[2].count).toBe(3);
    expect(w.goals[2].optional).toBe(true);
    // and adding them to a full week changes nothing
    const full = weekAttainment({ plan, sessions: [ws(TUE, BC_TPL_A), ws(FRI, BC_TPL_B), ...acc], boxing: [box(MON), box(WED), box(SAT), box(SUN)] }, SUN);
    expect(full.target).toBe(true);
  });

  it('weekly counts reset on Monday', () => {
    const boxing = [box(PREV_SUN), box(MON)];
    expect(goalCount(plan.weeklyGoals[0], { sessions: [], boxing }, MON, SUN)).toBe(1);
    const prev = weekAttainment({ plan, sessions: [], boxing }, PREV_SUN);
    expect(prev.goals[0].count).toBe(1);
    const cur = weekAttainment({ plan, sessions: [ws(PREV_SUN, BC_TPL_A)], boxing }, MON);
    expect(cur.goals[1].count).toBe(0);
    expect(cur.weekStart).toBe(MON);
    expect(cur.weekEnd).toBe(SUN);
  });

  it('summary line reads BOX x/4 · STR y/2', () => {
    const w = weekAttainment({ plan, sessions: [ws(TUE, BC_TPL_A)], boxing: [box(MON), box(WED), box(SAT)] }, SUN);
    expect(weekSummaryLine(w)).toBe('BOX 3/4 · STR 1/2');
  });
});

describe('A/B rotation', () => {
  const rg = plan.weeklyGoals[1] as Extract<(typeof plan.weeklyGoals)[number], { kind: 'rotation' }>;

  it('starts at A with no history', () => {
    expect(nextRotationTemplateId(rg, [])).toBe(BC_TPL_A);
  });

  it('is determined by the most recently COMPLETED rotation session', () => {
    expect(nextRotationTemplateId(rg, [ws(TUE, BC_TPL_A)])).toBe(BC_TPL_B);
    expect(nextRotationTemplateId(rg, [ws(TUE, BC_TPL_A), ws(FRI, BC_TPL_B)])).toBe(BC_TPL_A);
    // an active (unfinished) session does not advance it
    const active = { ...ws(SAT, BC_TPL_A), status: 'active' as const };
    expect(nextRotationTemplateId(rg, [ws(TUE, BC_TPL_A), ws(FRI, BC_TPL_B), active])).toBe(BC_TPL_A);
  });

  it('does NOT reset on Monday', () => {
    // Sunday A → Monday next should be B
    expect(nextRotationTemplateId(rg, [ws(PREV_SUN, BC_TPL_A)])).toBe(BC_TPL_B);
    expect(nextRotationTemplateId(rg, [ws(SAT, BC_TPL_B), ws(SUN, BC_TPL_A)])).toBe(BC_TPL_B);
  });

  it('ignores optional/other sessions and letters map to slots', () => {
    expect(nextRotationTemplateId(rg, [ws(TUE, BC_TPL_A), ws(WED, BC_TPL_OPT)])).toBe(BC_TPL_B);
    expect(rotationLetter(rg, BC_TPL_A)).toBe('A');
    expect(rotationLetter(rg, BC_TPL_B)).toBe('B');
    expect(rotationLetter(rg, BC_TPL_OPT)).toBeNull();
  });
});

describe('training record (calendar)', () => {
  it('blank days are neutral', () => {
    const r = dayRecord(WED, { plan, sessions: [], boxing: [] });
    expect(r.tags).toEqual([]);
  });

  it('shows what occurred: BOX, A, B, ACC and combinations', () => {
    const ctx = { plan, sessions: [ws(TUE, BC_TPL_A), ws(TUE, BC_TPL_OPT, 20), ws(FRI, BC_TPL_B)], boxing: [box(TUE)] };
    expect(dayRecord(TUE, ctx).tags).toEqual(['BOX', 'A', 'ACC']);
    expect(dayRecord(FRI, ctx).tags).toEqual(['B']);
    expect(sessionTag({ ...ws(SAT, 'tpl_custom'), name: 'PUSH DAY' }, plan)).toBe('PUS');
  });
});

describe('weekly streaks', () => {
  it('foundation streak counts consecutive weeks meeting minimums; current week never breaks it', () => {
    const sessions = [ws('2026-08-19', BC_TPL_A), ws('2026-08-26', BC_TPL_B)];
    const boxing = [box('2026-08-18'), box('2026-08-20'), box('2026-08-25'), box('2026-08-27')];
    // weeks of Aug 17 and Aug 24 meet foundation; current week (Aug 31) empty so far
    expect(foundationStreak({ plan, sessions, boxing, startDate: '2026-08-17' }, TUE)).toBe(2);
    // current week met → 3
    expect(foundationStreak({ plan, sessions: [...sessions, ws(MON, BC_TPL_A)], boxing: [...boxing, box(MON), box(TUE)], startDate: '2026-08-17' }, TUE)).toBe(3);
    // a gap week breaks it
    expect(foundationStreak({ plan, sessions: [ws('2026-08-12', BC_TPL_A), ws('2026-08-26', BC_TPL_B)], boxing: [box('2026-08-11'), box('2026-08-13'), box('2026-08-25'), box('2026-08-27')], startDate: '2026-08-10' }, TUE)).toBe(1);
  });

  it('target weeks counts full-target weeks among the previous 8', () => {
    const sessions = [ws('2026-08-18', BC_TPL_A), ws('2026-08-21', BC_TPL_B)];
    const boxing = [box('2026-08-17'), box('2026-08-19'), box('2026-08-22'), box('2026-08-23')];
    const tw = targetWeeks({ plan, sessions, boxing, startDate: '2026-07-01' }, TUE);
    expect(tw).toEqual({ hit: 1, of: 8 });
    expect(targetWeeks({ plan, sessions, boxing, startDate: '2026-08-17' }, NEXT_MON).of).toBe(3);
  });
});
