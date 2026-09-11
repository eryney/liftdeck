import { describe, expect, it } from 'vitest';
import { buildPlanBundle, parsePlanBundle, planTemplateIds, resolveBundle } from '../src/lib/planBundle';
import { BOXER_CUT_PLAN, BOXER_CUT_TEMPLATES, BC_TPL_A, BC_TPL_B, BC_TPL_OPT, LEGACY_SEED_PLAN, LEGACY_SEED_TEMPLATES } from '../src/data/seedPlan';
import { EXERCISE_LIBRARY } from '../src/data/exercises';
import { PLAN_BUNDLE_VERSION } from '../src/types';

const V1_LIBRARY = EXERCISE_LIBRARY.filter((e) => e.id !== 'cable-leg-curl');

describe('buildPlanBundle', () => {
  it('bundles the plan, its templates and only non-v1-library exercises', () => {
    const b = buildPlanBundle(BOXER_CUT_PLAN, BOXER_CUT_TEMPLATES, EXERCISE_LIBRARY);
    expect(b.app).toBe('liftdeck-plan');
    expect(b.schemaVersion).toBe(PLAN_BUNDLE_VERSION);
    expect(b.templates.map((t) => t.id).sort()).toEqual([BC_TPL_A, BC_TPL_B, BC_TPL_OPT].sort());
    expect(b.exercises.map((e) => e.id)).toEqual(['cable-leg-curl']);
    expect(Object.keys(b).sort()).toEqual(['app', 'exercises', 'exportedAt', 'plan', 'schemaVersion', 'templates']);
  });

  it('handles fixed plans too', () => {
    expect(planTemplateIds(LEGACY_SEED_PLAN)).toHaveLength(3);
    const b = buildPlanBundle(LEGACY_SEED_PLAN, LEGACY_SEED_TEMPLATES, EXERCISE_LIBRARY);
    expect(b.templates).toHaveLength(3);
    expect(b.exercises).toEqual([]);
  });
});

describe('parsePlanBundle', () => {
  const good = () => JSON.stringify(buildPlanBundle(BOXER_CUT_PLAN, BOXER_CUT_TEMPLATES, EXERCISE_LIBRARY));

  it('round-trips and validates against the known exercise ids (custom cable-leg-curl imports on a v1 library)', () => {
    const b = parsePlanBundle(good(), V1_LIBRARY.map((e) => e.id));
    expect(b.plan.id).toBe(BOXER_CUT_PLAN.id);
    expect(b.exercises[0]).toMatchObject({ id: 'cable-leg-curl', category: 'Hamstrings', equipment: 'cable', perSide: true });
  });

  it('rejects wrong files with readable errors', () => {
    expect(() => parsePlanBundle('nope')).toThrow(/valid JSON/);
    expect(() => parsePlanBundle('{"app":"liftdeck"}')).toThrow(/full backup/);
    expect(() => parsePlanBundle('{"app":"x"}')).toThrow(/not a LIFTDECK plan/);
    expect(() => parsePlanBundle(JSON.stringify({ app: 'liftdeck-plan', schemaVersion: 99, plan: {}, templates: [] }))).toThrow(/newer/);
  });

  it('bad exercise references produce readable errors', () => {
    const b = JSON.parse(good());
    b.exercises = []; // drop cable-leg-curl definition
    expect(() => parsePlanBundle(JSON.stringify(b), V1_LIBRARY.map((e) => e.id))).toThrow(/STRENGTH B.*unknown exercise "cable-leg-curl"/);
  });

  it('bad template references and malformed goals produce readable errors', () => {
    const b = JSON.parse(good());
    b.templates = b.templates.filter((t: any) => t.id !== BC_TPL_B);
    expect(() => parsePlanBundle(JSON.stringify(b))).toThrow(/references template "tpl_bc_strength_b"/);
    const c = JSON.parse(good());
    c.plan.weeklyGoals[0].minimum = 'two';
    expect(() => parsePlanBundle(JSON.stringify(c))).toThrow(/numeric minimum/);
    const d = JSON.parse(good());
    d.templates[0].exercises[0].sets = 'x';
    expect(() => parsePlanBundle(JSON.stringify(d))).toThrow(/non-numeric sets/);
  });

  it('accepts legacy fixed plans without a mode field', () => {
    const b = parsePlanBundle(JSON.stringify(buildPlanBundle(LEGACY_SEED_PLAN, LEGACY_SEED_TEMPLATES, EXERCISE_LIBRARY)));
    expect((b.plan as any).mode).toBeUndefined();
    expect('schedule' in b.plan).toBe(true);
  });
});

describe('resolveBundle (collisions)', () => {
  const bundle = parsePlanBundle(JSON.stringify(buildPlanBundle(BOXER_CUT_PLAN, BOXER_CUT_TEMPLATES, EXERCISE_LIBRARY)), V1_LIBRARY.map((e) => e.id));

  it('adds everything on a clean device', () => {
    const r = resolveBundle(bundle, { plans: [], templates: [], exercises: V1_LIBRARY });
    expect(r.plan.id).toBe(BOXER_CUT_PLAN.id);
    expect(r.templates).toHaveLength(3);
    expect(r.exercises.map((e) => e.id)).toEqual(['cable-leg-curl']);
    expect(r.notes).toEqual([]);
  });

  it('reuses identical existing templates/exercises and gives the plan a fresh id', () => {
    const r = resolveBundle(bundle, { plans: [BOXER_CUT_PLAN], templates: BOXER_CUT_TEMPLATES, exercises: EXERCISE_LIBRARY });
    expect(r.templates).toEqual([]);
    expect(r.exercises).toEqual([]);
    expect(r.plan.id).toBe(`${BOXER_CUT_PLAN.id}_2`);
    expect(r.notes.join(' ')).toMatch(/already exists/);
  });

  it('renames a template whose id is taken by an edited version and remaps the plan', () => {
    const edited = { ...BOXER_CUT_TEMPLATES[0], exercises: BOXER_CUT_TEMPLATES[0].exercises.slice(1) };
    const r = resolveBundle(bundle, { plans: [], templates: [edited], exercises: EXERCISE_LIBRARY });
    const newA = r.templates.find((t) => t.name === 'STRENGTH A')!;
    expect(newA.id).toBe(`${BC_TPL_A}_2`);
    const rot = (r.plan as typeof BOXER_CUT_PLAN).weeklyGoals[1] as any;
    expect(rot.templateIds).toEqual([`${BC_TPL_A}_2`, BC_TPL_B]);
  });

  it('never overwrites an existing exercise definition with a different meaning', () => {
    const clash = { id: 'cable-leg-curl', name: 'Something Else', category: 'Other', equipment: 'other', custom: true } as const;
    const r = resolveBundle(bundle, { plans: [], templates: [], exercises: [...V1_LIBRARY, clash] });
    expect(r.exercises[0].id).toBe('cable-leg-curl_2');
    const b = r.templates.find((t) => t.id === BC_TPL_B)!;
    expect(b.exercises.some((te) => te.exerciseId === 'cable-leg-curl_2')).toBe(true);
    expect(b.exercises.some((te) => te.exerciseId === 'cable-leg-curl')).toBe(false);
  });
});
