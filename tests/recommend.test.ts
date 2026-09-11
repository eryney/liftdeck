import { describe, expect, it } from 'vitest';
import { recommend } from '../src/lib/recommend';
import { BOXER_CUT_PLAN, BC_TPL_A, BC_TPL_B, BC_TPL_OPT } from '../src/data/seedPlan';
import type { BoxingAttendance, WorkoutSession } from '../src/types';

const MON = '2026-08-31';
const TUE = '2026-09-01';
const WED = '2026-09-02';
const THU = '2026-09-03';
const SAT = '2026-09-05';
const SUN = '2026-09-06';

let n = 0;
const ts = (date: string, hour: number) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();
function ws(date: string, templateId: string, hour = 18): WorkoutSession {
  const startedAt = ts(date, hour);
  return { id: `ws-${++n}`, date, name: 'X', templateId, status: 'completed', startedAt, finishedAt: startedAt + 3600000, exercises: [] };
}
function box(date: string, hour = 19, extra: Partial<BoxingAttendance> = {}): BoxingAttendance {
  return { id: `bx-${++n}`, date, loggedAt: ts(date, hour), ...extra };
}
const plan = BOXER_CUT_PLAN;
const at = (date: string, hour = 10) => ({ now: ts(date, hour), today: date });

describe('recommendation engine', () => {
  it('first priority: the strength floor (0 this week, rested)', () => {
    const r = recommend({ plan, sessions: [], boxing: [box(MON), box(TUE)], ...at(WED) });
    expect(r.primary).toMatchObject({ kind: 'strength', templateId: BC_TPL_A });
  });

  it('then boxing below minimum', () => {
    const r = recommend({ plan, sessions: [ws(MON, BC_TPL_A)], boxing: [], ...at(WED) });
    expect(r.primary.kind).toBe('boxing');
  });

  it('then the second strength exposure, respecting A/B rotation', () => {
    const r = recommend({ plan, sessions: [ws(MON, BC_TPL_A)], boxing: [box(TUE), box(WED)], ...at(THU) });
    expect(r.primary).toMatchObject({ kind: 'strength', templateId: BC_TPL_B });
    const r2 = recommend({ plan, sessions: [ws(SUN, BC_TPL_A, 18)], boxing: [box(MON), box(TUE)], ...at('2026-09-08') }); // rotation crosses the Monday boundary
    expect(r2.strength.nextTemplateId).toBe(BC_TPL_B);
  });

  it('then boxing toward target; then optional/recovery', () => {
    const base = { plan, sessions: [ws(MON, BC_TPL_A), ws(WED, BC_TPL_B)], boxing: [box(TUE), box(THU)] };
    expect(recommend({ ...base, ...at(SAT) }).primary.kind).toBe('boxing');
    const full = { ...base, boxing: [box(TUE), box(THU), box(SAT), box(SUN, 9)] };
    const r = recommend({ ...full, ...at(SUN, 12) });
    expect(r.primary).toMatchObject({ kind: 'accessory', templateId: BC_TPL_OPT });
    expect(r.targetMet).toBe(true);
    // once the optional is done too → recovery
    const done = recommend({ ...full, sessions: [...full.sessions, ws(SUN, BC_TPL_OPT, 10)], ...at(SUN, 12) });
    expect(done.primary.kind).toBe('recovery');
  });

  it('never blocks: <36h since strength is a warning, boxing stays available', () => {
    // lifted Wednesday evening, now Thursday morning (~16h)
    const r = recommend({ plan, sessions: [ws(WED, BC_TPL_A, 18)], boxing: [box(MON), box(TUE)], ...at(THU, 10) });
    expect(r.strength.gapOk).toBe(false);
    expect(r.notes.some((x) => x.id === 'strength-gap')).toBe(true);
    expect(r.primary.kind).not.toBe('strength'); // not recommended, but nothing prevents starting it
    expect(r.strength.nextTemplateId).toBe(BC_TPL_B); // still resolvable for START SOMETHING ELSE
    // and after 36h the strength target is recommended again
    const later = recommend({ plan, sessions: [ws(WED, BC_TPL_A, 18)], boxing: [box(MON), box(TUE)], ...at(SAT, 10) });
    expect(later.primary).toMatchObject({ kind: 'strength', templateId: BC_TPL_B });
  });

  it('hard boxing in the last 24h produces a warning, not a block', () => {
    const hard = box(WED, 19, { rpe: 9 });
    const r = recommend({ plan, sessions: [], boxing: [box(MON), hard], ...at(THU, 10) });
    expect(r.hardBoxingRecent).toBe(true);
    expect(r.notes.map((x) => x.id)).toContain('hard-boxing');
    expect(r.primary.kind).toBe('strength'); // still the floor
    // sparring with meaningful duration counts as hard too; short sparring doesn't
    expect(recommend({ plan, sessions: [], boxing: [box(WED, 19, { sessionType: 'sparring', durationMin: 45 })], ...at(THU, 10) }).hardBoxingRecent).toBe(true);
    expect(recommend({ plan, sessions: [], boxing: [box(WED, 19, { sessionType: 'sparring', durationMin: 15 })], ...at(THU, 10) }).hardBoxingRecent).toBe(false);
    // 30h later → no warning
    expect(recommend({ plan, sessions: [], boxing: [hard], ...at('2026-09-04', 2) }).hardBoxingRecent).toBe(false);
  });

  it('optional work is never prioritised over unmet core targets', () => {
    // strength done twice, boxing below minimum → boxing, and the optional is hidden
    const r = recommend({ plan, sessions: [ws(MON, BC_TPL_A), ws(WED, BC_TPL_B)], boxing: [box(TUE)], ...at(SAT) });
    expect(r.primary.kind).toBe('boxing');
    expect(r.accessory?.visible).toBe(false);
    // only one strength session → hidden
    const r2 = recommend({ plan, sessions: [ws(MON, BC_TPL_A)], boxing: [box(TUE), box(WED), box(THU), box(SAT)], ...at(SAT, 22) });
    expect(r2.accessory?.visible).toBe(false);
    // hard boxing in the last 24h → hidden even when everything is met
    const r3 = recommend({ plan, sessions: [ws(MON, BC_TPL_A), ws(WED, BC_TPL_B)], boxing: [box(TUE), box(THU), box(SAT), box(SUN, 9, { rpe: 9 })], ...at(SUN, 12) });
    expect(r3.accessory?.visible).toBe(false);
    expect(r3.primary.kind).toBe('recovery');
  });

  it('strength at its soft max is not recommended again', () => {
    const r = recommend({ plan, sessions: [ws(MON, BC_TPL_A), ws(WED, BC_TPL_B)], boxing: [box(TUE), box(THU)], ...at(SAT) });
    expect(r.primary.kind).toBe('boxing');
    expect(r.strength.count).toBe(2);
  });

  it('boxing already logged today falls through to the next rule instead of recommending boxing again', () => {
    const r = recommend({ plan, sessions: [ws(MON, BC_TPL_A)], boxing: [box(TUE, 8)], ...at(TUE, 12) });
    expect(r.primary.kind).toBe('recovery'); // strength <36h, boxing done today
    expect(r.primary.reason).toMatch(/BOXING LOGGED TODAY/);
    const r2 = recommend({ plan, sessions: [ws(MON, BC_TPL_A)], boxing: [box(THU, 8)], ...at(THU, 12) });
    expect(r2.primary).toMatchObject({ kind: 'strength', templateId: BC_TPL_B }); // rested → strength target
  });

  it('same-day note appears only when boxing and lifting land on the same day', () => {
    const r = recommend({ plan, sessions: [], boxing: [box(WED, 8)], ...at(WED, 12) });
    expect(r.notes.map((x) => x.id)).toContain('same-day');
    const r2 = recommend({ plan, sessions: [], boxing: [box(TUE)], ...at(WED, 12) });
    expect(r2.notes.map((x) => x.id)).not.toContain('same-day');
  });
});
