import { describe, expect, it } from 'vitest';
import { dayRecord, foundationStreak, goalCount, nextRotationTemplateId, optionalTemplateIds, strengthTemplateIds, targetWeeks, weekAttainment } from '../src/lib/flex';
import { SEED_PLAN, TPL_FLOW, TPL_LA, TPL_LB, TPL_UA, TPL_UB } from '../src/data/seedPlan';
import type { WorkoutSession } from '../src/types';

let n = 0;
function ws(date: string, templateId: string, status: WorkoutSession['status'] = 'completed'): WorkoutSession {
  n += 1;
  const t = new Date(`${date}T10:00:00`).getTime() + n;
  return { id: `ws${n}`, date, name: templateId, templateId, status, startedAt: t, finishedAt: t + 3_000_000, exercises: [] };
}

const plan = SEED_PLAN;
const rot = plan.weeklyGoals.find((g) => g.kind === 'rotation')!;
const flow = plan.weeklyGoals.find((g) => g.kind === 'workout')!;

describe('weekly attainment', () => {
  it('counts rotation sessions Mon–Sun regardless of weekday; optional goals never gate the verdict', () => {
    // week of Mon 2026-08-31
    const sessions = [ws('2026-08-31', TPL_UA), ws('2026-09-01', TPL_LA), ws('2026-09-05', TPL_UB), ws('2026-09-06', TPL_FLOW)];
    const w = weekAttainment({ plan, sessions }, '2026-09-03');
    expect(w.weekStart).toBe('2026-08-31');
    expect(w.weekEnd).toBe('2026-09-06');
    expect(w.goals.find((g) => g.goal.id === rot.id)).toMatchObject({ count: 3, minMet: true, targetMet: false, optional: false });
    expect(w.goals.find((g) => g.goal.id === flow.id)).toMatchObject({ count: 1, optional: true });
    expect(w.foundation).toBe(true);
    expect(w.target).toBe(false);
    const w2 = weekAttainment({ plan, sessions: [...sessions, ws('2026-09-06', TPL_LB)] }, '2026-09-06');
    expect(w2.target).toBe(true);
  });

  it('ignores active sessions and sessions outside the week', () => {
    const sessions = [ws('2026-08-30', TPL_UA), ws('2026-09-07', TPL_LA), ws('2026-09-02', TPL_UB, 'active')];
    expect(goalCount(rot, { sessions }, '2026-08-31', '2026-09-06')).toBe(0);
  });

  it('helpers know which templates are strength and which are optional', () => {
    expect(strengthTemplateIds(plan)).toEqual([TPL_UA, TPL_LA, TPL_UB, TPL_LB]);
    expect(optionalTemplateIds(plan)).toEqual([TPL_FLOW]);
  });
});

describe('rotation', () => {
  it('is driven only by the most recently completed rotation session, never by the calendar', () => {
    expect(nextRotationTemplateId(rot as any, [])).toBe(TPL_UA);
    expect(nextRotationTemplateId(rot as any, [ws('2026-09-01', TPL_UA)])).toBe(TPL_LA);
    expect(nextRotationTemplateId(rot as any, [ws('2026-09-01', TPL_UA), ws('2026-09-02', TPL_LA)])).toBe(TPL_UB);
    // Monday does not reset it
    expect(nextRotationTemplateId(rot as any, [ws('2026-09-06', TPL_LB)])).toBe(TPL_UA);
    expect(nextRotationTemplateId(rot as any, [ws('2026-09-06', TPL_UB)])).toBe(TPL_LB);
    // optional sessions and active sessions do not move it
    expect(nextRotationTemplateId(rot as any, [ws('2026-09-01', TPL_UA), ws('2026-09-02', TPL_FLOW), ws('2026-09-03', TPL_LA, 'active')])).toBe(TPL_LA);
  });
});

describe('streaks', () => {
  it('foundation streak walks back over weeks at the minimum; the current week never breaks it', () => {
    const sessions = [
      ws('2026-08-17', TPL_UA), ws('2026-08-19', TPL_LA), ws('2026-08-21', TPL_UB), // week 1: 3
      ws('2026-08-24', TPL_LB), ws('2026-08-26', TPL_UA), ws('2026-08-28', TPL_LA), ws('2026-08-29', TPL_UB), // week 2: 4
      ws('2026-08-31', TPL_LB), // current week: 1 so far
    ];
    expect(foundationStreak({ plan, sessions, startDate: '2026-08-17' }, '2026-09-02')).toBe(2);
    expect(foundationStreak({ plan, sessions: [...sessions, ws('2026-09-01', TPL_UA), ws('2026-09-02', TPL_LA)], startDate: '2026-08-17' }, '2026-09-02')).toBe(3);
    // a week at 2 breaks it
    const broken = sessions.filter((s) => s.date < '2026-08-21' || s.date >= '2026-08-24');
    expect(foundationStreak({ plan, sessions: broken, startDate: '2026-08-17' }, '2026-09-02')).toBe(1);
    // weeks before the start date are not judged
    expect(foundationStreak({ plan, sessions, startDate: '2026-08-24' }, '2026-09-02')).toBe(1);
  });

  it('targetWeeks counts complete previous weeks at the target', () => {
    const sessions = [ws('2026-08-24', TPL_LB), ws('2026-08-26', TPL_UA), ws('2026-08-28', TPL_LA), ws('2026-08-29', TPL_UB)];
    expect(targetWeeks({ plan, sessions, startDate: '2026-08-17' }, '2026-09-02')).toEqual({ hit: 1, of: 2 });
  });

  it('dayRecord lists completed sessions on a date, oldest first', () => {
    const a = ws('2026-09-01', TPL_UA);
    const b = ws('2026-09-01', TPL_FLOW);
    expect(dayRecord('2026-09-01', { sessions: [b, a, ws('2026-09-02', TPL_LA)] }).sessions.map((s) => s.id)).toEqual([a.id, b.id]);
    expect(dayRecord('2026-09-03', { sessions: [a] }).sessions).toEqual([]);
  });
});
