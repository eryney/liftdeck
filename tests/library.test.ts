import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY } from '../src/data/exercises';
import { PROGRESSIONS, chainLevels } from '../src/data/progressions';
import { SEED_PLAN, SEED_TEMPLATES, TPL_FLOW, TPL_LA, TPL_LB, TPL_UA, TPL_UB } from '../src/data/seedPlan';
import { SUGGESTED_SUBSTITUTES } from '../src/data/substitutions';

const byId = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));

describe('the bundled program', () => {
  it('references only library exercises, with unique slot ids', () => {
    const slotIds = new Set<string>();
    for (const t of SEED_TEMPLATES) {
      for (const te of t.exercises) {
        expect(byId.has(te.exerciseId), `${t.name}: ${te.exerciseId}`).toBe(true);
        expect(slotIds.has(te.id)).toBe(false);
        slotIds.add(te.id);
        expect(te.repMin).toBeLessThanOrEqual(te.repMax);
        expect(te.sets).toBeGreaterThan(0);
        // timed exercises get second ranges, rep exercises get rep ranges
        if (byId.get(te.exerciseId)!.timed) expect(te.repMin).toBeGreaterThanOrEqual(10);
        else expect(te.repMax).toBeLessThanOrEqual(20);
      }
      // a superset flag never dangles on the last slot
      expect(t.exercises[t.exercises.length - 1].superset).toBeUndefined();
    }
    for (const g of SEED_PLAN.weeklyGoals) {
      const ids = g.kind === 'rotation' ? g.templateIds : [g.templateId];
      for (const id of ids) expect(SEED_TEMPLATES.some((t) => t.id === id)).toBe(true);
    }
  });

  it('is an upper/lower rotation with every strength chain trained once or twice a week', () => {
    const rot = SEED_PLAN.weeklyGoals.find((g) => g.kind === 'rotation')!;
    expect(rot.kind === 'rotation' && rot.templateIds).toEqual([TPL_UA, TPL_LA, TPL_UB, TPL_LB]);
    expect(rot).toMatchObject({ minimum: 3, target: 4, max: 5, minGapHours: 20 });
    const flow = SEED_PLAN.weeklyGoals.find((g) => g.kind === 'workout')!;
    expect(flow).toMatchObject({ templateId: TPL_FLOW, optional: true, minimum: 0 });

    const chainExposures = new Map<string, number>();
    for (const t of SEED_TEMPLATES.filter((t) => t.id !== TPL_FLOW)) {
      for (const te of t.exercises) {
        const p = byId.get(te.exerciseId)!.progressionId;
        if (p) chainExposures.set(p, (chainExposures.get(p) ?? 0) + 1);
      }
    }
    // the bar skills are in
    for (const id of ['pull', 'chin', 'row', 'frontlever', 'planche', 'push', 'vpush', 'dip', 'squat', 'lunge', 'hinge', 'glute', 'calf', 'hangcore', 'lsit', 'side', 'dragon']) {
      expect(chainExposures.get(id), `${id} is trained`).toBeGreaterThanOrEqual(1);
      expect(chainExposures.get(id), `${id} at most twice`).toBeLessThanOrEqual(2);
    }
    // muscle-ups need a bar with clearance, so they stay out of the default program
    expect(chainExposures.has('muscleup')).toBe(false);
  });

  it('a chain trained twice a week uses the same rep range both times (so graduation has one meaning)', () => {
    const ranges = new Map<string, string>();
    for (const t of SEED_TEMPLATES.filter((t) => t.id !== TPL_FLOW)) {
      for (const te of t.exercises) {
        const p = byId.get(te.exerciseId)!.progressionId;
        if (!p) continue;
        const r = `${te.repMin}-${te.repMax}`;
        if (ranges.has(p)) expect(ranges.get(p), `${p} rep range`).toBe(r);
        ranges.set(p, r);
      }
    }
  });

  it('primary pulls and pushes run 5–8 for strength; every session has antagonist pairs and a warm-up', () => {
    const ua = SEED_TEMPLATES.find((t) => t.id === TPL_UA)!;
    expect(ua.exercises[0]).toMatchObject({ exerciseId: 'pull-up', sets: 3, repMin: 5, repMax: 8, superset: true });
    expect(ua.exercises[1]).toMatchObject({ exerciseId: 'push-up', sets: 3, repMin: 5, repMax: 8 });
    expect(ua.exercises[4]).toMatchObject({ exerciseId: 'tuck-front-lever', repMin: 10, repMax: 20 });
    expect(ua.exercises[5]).toMatchObject({ exerciseId: 'planche-lean' });
    for (const t of SEED_TEMPLATES) {
      expect(t.warmup?.length).toBeGreaterThan(0);
      if (t.id !== TPL_FLOW) expect(t.exercises.some((te) => te.superset)).toBe(true);
    }
  });

  it('every progression has rungs, and every substitution points at a real exercise', () => {
    for (const p of PROGRESSIONS) expect(chainLevels(EXERCISE_LIBRARY, p.id).length, p.id).toBeGreaterThanOrEqual(3);
    for (const [from, subs] of Object.entries(SUGGESTED_SUBSTITUTES)) {
      expect(byId.has(from), from).toBe(true);
      for (const s of subs) expect(byId.has(s), `${from} → ${s}`).toBe(true);
    }
  });
});
