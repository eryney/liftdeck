import { describe, expect, it } from 'vitest';
import { recommend } from '../src/lib/recommend';
import { SEED_PLAN, TPL_FLOW, TPL_LA, TPL_LB, TPL_UA, TPL_UB } from '../src/data/seedPlan';
import type { WorkoutSession } from '../src/types';

let n = 0;
function ws(date: string, templateId: string, hour = 10): WorkoutSession {
  n += 1;
  const t = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();
  return { id: `ws${n}`, date, name: templateId, templateId, status: 'completed', startedAt: t, finishedAt: t + 45 * 60_000, exercises: [] };
}

const at = (date: string, hour = 18) => new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`).getTime();
const plan = SEED_PLAN;

describe('recommend', () => {
  it('an empty week asks for the first session of the rotation', () => {
    const r = recommend({ plan, sessions: [], today: '2026-09-01', now: at('2026-09-01') });
    expect(r.primary).toMatchObject({ kind: 'strength', templateId: TPL_UA });
    expect(r.primary.reason).toMatch(/First session/);
    expect(r.strength).toMatchObject({ count: 0, target: 4, gapOk: true });
    expect(r.optional?.visible).toBe(false); // strength is the call today
  });

  it('too soon after a session → rest, with the next template still known and the optional session offered', () => {
    const sessions = [ws('2026-09-01', TPL_UA, 10)];
    const r = recommend({ plan, sessions, today: '2026-09-01', now: at('2026-09-01', 18) });
    expect(r.primary.kind).toBe('rest');
    expect(r.primary.reason).toMatch(/Done for today/);
    expect(r.strength).toMatchObject({ nextTemplateId: TPL_LA, count: 1, gapOk: false, minGapHours: 20 });
    expect(r.optional?.visible).toBe(true);
    // next morning (≥ 20 h): Lower A
    const r2 = recommend({ plan, sessions, today: '2026-09-02', now: at('2026-09-02', 8) });
    expect(r2.primary).toMatchObject({ kind: 'strength', templateId: TPL_LA });
    expect(r2.primary.reason).toMatch(/1 of 4/);
  });

  it('the evening before a rested morning explains the wait in hours', () => {
    const sessions = [ws('2026-09-01', TPL_UA, 10)];
    const r = recommend({ plan, sessions, today: '2026-09-02', now: at('2026-09-02', 5) });
    expect(r.primary.kind).toBe('rest');
    expect(r.primary.reason).toMatch(/about 2 h/);
    expect(r.notes[0]).toMatch(/20 h/);
  });

  it('target met → bonus offered up to the soft max, then rest', () => {
    const four = [ws('2026-08-31', TPL_UA), ws('2026-09-01', TPL_LA), ws('2026-09-02', TPL_UB), ws('2026-09-03', TPL_LB)];
    const r = recommend({ plan, sessions: four, today: '2026-09-05', now: at('2026-09-05') });
    expect(r.primary).toMatchObject({ kind: 'bonus', templateId: TPL_UA });
    expect(r.targetMet).toBe(true);
    const five = [...four, ws('2026-09-04', TPL_UA)];
    const r2 = recommend({ plan, sessions: five, today: '2026-09-05', now: at('2026-09-05') });
    expect(r2.primary.kind).toBe('rest');
    expect(r2.primary.reason).toMatch(/Week complete/);
    expect(r2.optional?.visible).toBe(true);
  });

  it('the optional session has its own cap and never counts toward strength', () => {
    const sessions = [ws('2026-08-31', TPL_FLOW), ws('2026-09-01', TPL_FLOW)];
    const r = recommend({ plan, sessions, today: '2026-09-02', now: at('2026-09-02') });
    expect(r.primary).toMatchObject({ kind: 'strength', templateId: TPL_UA });
    expect(r.strength.count).toBe(0);
    expect(r.optional).toMatchObject({ count: 2, max: 2, visible: false });
  });

  it('a new week starts the count over but keeps the rotation where it was', () => {
    const sessions = [ws('2026-08-31', TPL_UA), ws('2026-09-01', TPL_LA), ws('2026-09-03', TPL_UB), ws('2026-09-05', TPL_LB)];
    const r = recommend({ plan, sessions, today: '2026-09-07', now: at('2026-09-07') });
    expect(r.primary).toMatchObject({ kind: 'strength', templateId: TPL_UA });
    expect(r.strength.count).toBe(0);
  });
});
