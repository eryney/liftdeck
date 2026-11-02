import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY } from '../src/data/exercises';
import { PROGRESSIONS, chainLevels } from '../src/data/progressions';
import { SEED_PLAN, SEED_TEMPLATES } from '../src/data/seedPlan';
import { TPL_FA, TPL_FB, TPL_ACCESSORY, TPL_CARDIO } from '../src/data/fullBodyPlan';
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
      expect(t.exercises[t.exercises.length - 1]?.superset).toBeUndefined();
    }
    for (const g of SEED_PLAN.weeklyGoals) {
      const ids = g.kind === 'rotation' ? g.templateIds : [g.templateId];
      for (const id of ids) expect(SEED_TEMPLATES.some((t) => t.id === id)).toBe(true);
    }
  });

  it('alternates full-body sessions three times weekly with two shared optional sessions', () => {
    const rot = SEED_PLAN.weeklyGoals.find((g) => g.kind === 'rotation')!;
    expect(rot).toMatchObject({ templateIds: [TPL_FA, TPL_FB], minimum: 3, target: 3, max: 3, restDays: 1 });
    expect(SEED_PLAN.weeklyGoals[1]).toMatchObject({ templateId: TPL_ACCESSORY, alternativeTemplateIds: [TPL_CARDIO], optional: true, minimum: 0, max: 2 });
    for (const t of SEED_TEMPLATES.filter((t) => [TPL_FA, TPL_FB].includes(t.id))) {
      expect(t.exercises).toHaveLength(9);
      expect(t.exercises.slice(0, 6).every((e) => e.sets === 3)).toBe(true);
      expect(t.exercises.slice(6).every((e) => e.sets === 2)).toBe(true);
      expect(t.exercises[1].exerciseId).toMatch(/squat|lunge/);
      expect(t.exercises[3].exerciseId).toMatch(/deadlift|leg-curl/);
      expect(t.exercises[4].exerciseId).toBe('band-bent-over-row');
      expect(t.exercises[5].exerciseId).toBe('push-up');
    }
  });

  it('a chain trained twice a week uses the same rep range both times (so graduation has one meaning)', () => {
    const ranges = new Map<string, string>();
    for (const t of SEED_TEMPLATES.filter((t) => [TPL_FA, TPL_FB].includes(t.id))) {
      for (const te of t.exercises) {
        const p = byId.get(te.exerciseId)!.progressionId;
        if (!p) continue;
        const r = `${te.repMin}-${te.repMax}`;
        if (ranges.has(p)) expect(ranges.get(p), `${p} rep range`).toBe(r);
        ranges.set(p, r);
      }
    }
  });

  it('pairs the primary movements and provides a warm-up for strength sessions', () => {
    const a = SEED_TEMPLATES.find((t) => t.id === TPL_FA)!;
    expect(a.exercises[0]).toMatchObject({ exerciseId: 'pull-up', sets: 3, repMin: 5, repMax: 8, superset: true });
    expect(a.exercises[1]).toMatchObject({ exerciseId: 'bulgarian-split-squat-bw', sets: 3 });
    for (const t of SEED_TEMPLATES.filter((t) => t.activityType !== 'cardio')) {
      expect(t.warmup?.length).toBeGreaterThan(0);
      expect(t.exercises.some((te) => te.superset)).toBe(true);
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
