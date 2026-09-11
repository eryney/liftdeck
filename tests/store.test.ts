import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../src/store/store';
import { bulkPut, closeDB, getDB, loadAll, put } from '../src/lib/db';
import { BOXER_CUT_PLAN_ID, BC_TPL_A, BC_TPL_B, LEGACY_SEED_PLAN, LEGACY_SEED_TEMPLATES, PLAN_ID } from '../src/data/seedPlan';
import { EXERCISE_LIBRARY } from '../src/data/exercises';
import { v1Backup } from './backup.test';
import { buildPlanBundle, parsePlanBundle, resolveBundle } from '../src/lib/planBundle';
import { buildBackup, parseBackup } from '../src/lib/backup';
import { SCHEMA_VERSION } from '../src/types';

async function wipe() {
  await closeDB();
  await new Promise<void>((res, rej) => {
    const r = indexedDB.deleteDatabase('liftdeck');
    r.onsuccess = () => res();
    r.onerror = () => rej(r.error);
    r.onblocked = () => res();
  });
}

/** Write a realistic v1 install straight into IndexedDB (as the 1.0 app left it). */
async function seedV1(overrides: { activePlanId?: string; plans?: any[]; templates?: any[] } = {}) {
  await getDB();
  const b = v1Backup();
  const v1Library = EXERCISE_LIBRARY.filter((e) => e.id !== 'cable-leg-curl');
  await bulkPut('exercises', v1Library);
  await bulkPut('templates', overrides.templates ?? b.templates);
  await bulkPut('plans', overrides.plans ?? b.plans);
  await bulkPut('sessions', b.sessions);
  await bulkPut('boxing', b.boxing);
  await bulkPut('measurements', b.measurements);
  await put('settings', { ...b.settings, activePlanId: overrides.activePlanId ?? b.settings.activePlanId });
  return b;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(wipe);
afterEach(async () => {
  await closeDB();
});

describe('fresh install', () => {
  it('seeds the exercise library and BOXER CUT // FLEX exactly once as the default plan', async () => {
    const s = new Store();
    await s.init();
    expect(s.state.plans.map((p) => p.id)).toEqual([BOXER_CUT_PLAN_ID]);
    expect(s.state.templates).toHaveLength(3);
    expect(s.state.exercises.some((e) => e.id === 'cable-leg-curl')).toBe(true);
    expect(s.state.settings).toMatchObject({ schemaVersion: SCHEMA_VERSION, goalMode: 'cut', goalDate: '2026-12-31', onboarded: false, seedMarkers: ['boxer-cut-flex-v1'] });
    expect(s.state.settings.goalWeightLb).toBeUndefined();
    expect(s.state.settings.goalWaistIn).toBeUndefined();
    // second boot: nothing duplicated
    const s2 = new Store();
    await s2.init();
    expect(s2.state.plans).toHaveLength(1);
    expect(s2.state.templates).toHaveLength(3);
    // onboarding picks the flex plan
    s2.completeOnboarding(BOXER_CUT_PLAN_ID);
    expect(s2.activePlan()?.id).toBe(BOXER_CUT_PLAN_ID);
  });
});

describe('existing v1 install migration', () => {
  it('preserves all data, adds the flex plan once, and activates it because the default plan was untouched', async () => {
    const raw = await seedV1();
    const s = new Store();
    await s.init();
    // history untouched
    expect(s.state.sessions).toEqual(raw.sessions);
    expect(s.state.boxing).toEqual(raw.boxing);
    expect(s.state.measurements).toEqual(raw.measurements);
    // legacy plan + templates still there, untouched
    expect(s.state.plans.find((p) => p.id === PLAN_ID)).toEqual(LEGACY_SEED_PLAN);
    const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id);
    expect([...s.state.templates.filter((t) => LEGACY_SEED_TEMPLATES.some((l) => l.id === t.id))].sort(byId)).toEqual([...LEGACY_SEED_TEMPLATES].sort(byId));
    // new plan + templates added, missing library exercise added
    expect(s.state.plans.some((p) => p.id === BOXER_CUT_PLAN_ID)).toBe(true);
    expect(s.state.templates.some((t) => t.id === BC_TPL_A)).toBe(true);
    expect(s.state.exercises.some((e) => e.id === 'cable-leg-curl')).toBe(true);
    expect(s.state.settings.activePlanId).toBe(BOXER_CUT_PLAN_ID);
    expect(s.state.settings).toMatchObject({ schemaVersion: SCHEMA_VERSION, goalMode: 'cut', goalDate: '2026-12-31', startDate: '2026-08-10' });
    // second boot: no duplication, and deleting the flex plan is respected forever after
    s.deletePlan(BOXER_CUT_PLAN_ID);
    await tick();
    const s2 = new Store();
    await s2.init();
    expect(s2.state.plans.some((p) => p.id === BOXER_CUT_PLAN_ID)).toBe(false);
    expect(s2.state.templates.filter((t) => t.id === BC_TPL_A)).toHaveLength(1);
  });

  it('does not change a customised active plan', async () => {
    const custom = { ...LEGACY_SEED_PLAN, schedule: LEGACY_SEED_PLAN.schedule.map((d, i) => (i === 4 ? { type: 'rest' as const } : d)) };
    await seedV1({ plans: [custom] });
    const s = new Store();
    await s.init();
    expect(s.state.settings.activePlanId).toBe(PLAN_ID);
    expect(s.state.plans.some((p) => p.id === BOXER_CUT_PLAN_ID)).toBe(true); // still added, just not activated
    expect(s.state.settings.goalMode).toBeNull();
  });

  it('does not change a user-created active plan', async () => {
    const mine = { id: 'plan_mine', name: 'MINE', schedule: Array.from({ length: 7 }, () => ({ type: 'rest' as const })) };
    await seedV1({ plans: [LEGACY_SEED_PLAN, mine], activePlanId: 'plan_mine' });
    const s = new Store();
    await s.init();
    expect(s.state.settings.activePlanId).toBe('plan_mine');
  });

  it('legacy fixed plans remain fully functional (weekday activities, legacy progression values)', async () => {
    await seedV1({ activePlanId: PLAN_ID, plans: [{ ...LEGACY_SEED_PLAN, name: 'PROGRAM 01 EDITED' }] });
    const s = new Store();
    await s.init();
    expect(s.activityFor('2026-09-01')).toEqual({ type: 'workout', templateId: 'tpl_strength_a' }); // Tuesday
    expect(s.activityFor('2026-08-31')).toEqual({ type: 'boxing' });
    // a v1 'progress' result still drives the next suggestion (45 + 5)
    const id = s.startWorkout('tpl_strength_a', '2026-09-01');
    const es = s.state.sessions.find((x) => x.id === id)!.exercises.find((e) => e.exerciseId === 'db-incline-press')!;
    expect(es.suggestedWeight).toBe(50);
  });

  it('an old backup imports through the full restore path and gets the same one-time additions', async () => {
    const s = new Store();
    await s.init();
    await s.importBackup(parseBackup(JSON.stringify(v1Backup())));
    expect(s.state.sessions).toEqual(v1Backup().sessions);
    expect(s.state.plans.some((p) => p.id === BOXER_CUT_PLAN_ID)).toBe(true);
    expect(s.state.settings.activePlanId).toBe(BOXER_CUT_PLAN_ID);
    // and a fresh v2 backup of it round-trips with every field
    const again = parseBackup(JSON.stringify(buildBackup(s.exportShape())));
    expect(again.plans.find((p) => p.id === BOXER_CUT_PLAN_ID)).toMatchObject({ mode: 'flex' });
  });
});

describe('sessions are immutable snapshots', () => {
  it('editing a template never rewrites past workouts', async () => {
    const s = new Store();
    await s.init();
    const id = s.startWorkout(BC_TPL_A, '2026-09-01');
    const session = s.state.sessions.find((x) => x.id === id)!;
    const es = session.exercises[2]; // incline press 3×6–10
    for (let i = 0; i < 3; i++) s.logSet(id, es.id, i, 10);
    s.finishWorkout(id);
    const before = JSON.stringify(s.state.sessions.find((x) => x.id === id));
    const tpl = s.templateById(BC_TPL_A)!;
    s.saveTemplate({ ...tpl, exercises: tpl.exercises.map((te) => ({ ...te, sets: 5, repMax: 20, increment: 10 })) });
    await tick();
    expect(JSON.stringify(s.state.sessions.find((x) => x.id === id))).toBe(before);
    const stored = (await loadAll()).sessions.find((x) => x.id === id)!;
    expect(stored.exercises[2].targetSets).toBe(3);
    expect(stored.exercises[2].result).toBe('increase');
  });

  it('finishing early marks INCOMPLETE and never triggers a reduction; extra sets do not decide', async () => {
    const s = new Store();
    await s.init();
    const id = s.startWorkout(BC_TPL_A, '2026-09-01');
    const session = s.state.sessions.find((x) => x.id === id)!;
    const split = session.exercises[0]; // 2×6–10
    const incline = session.exercises[2]; // 3×6–10
    s.logSet(id, split.id, 0, 10);
    s.logSet(id, split.id, 1, 10);
    s.addSet(id, split.id);
    s.logSet(id, split.id, 2, 3); // bonus set, terrible reps
    s.logSet(id, incline.id, 0, 4); // only one set, below range
    const done = s.finishWorkout(id)!;
    expect(done.exercises[0].result).toBe('increase');
    expect(done.exercises[2].result).toBe('incomplete');
    // next session: split squat +5, incline held (no reduction from an incomplete exposure)
    const id2 = s.startWorkout(BC_TPL_A, '2026-09-04');
    const next = s.state.sessions.find((x) => x.id === id2)!;
    expect(next.exercises[0].suggestedWeight).toBe(25);
    expect(next.exercises[2].suggestedWeight).toBe(35);
  });

  it('manual load override is preserved exactly and drives the next suggestion', async () => {
    const s = new Store();
    await s.init();
    const id = s.startWorkout(BC_TPL_B, '2026-09-01');
    const es = s.state.sessions.find((x) => x.id === id)!.exercises[1]; // db bench 3×6–10 start 40
    s.setExerciseWeight(id, es.id, 30); // tired day
    for (let i = 0; i < 3; i++) s.logSet(id, es.id, i, 10);
    const done = s.finishWorkout(id)!;
    expect(done.exercises[1]).toMatchObject({ weight: 30, suggestedWeight: 40, result: 'increase' });
    expect(done.exercises[1].sets.every((x) => x.weight === 30)).toBe(true);
    const id2 = s.startWorkout(BC_TPL_B, '2026-09-04');
    expect(s.state.sessions.find((x) => x.id === id2)!.exercises[1].suggestedWeight).toBe(32.5);
  });

  it('substitution follows exercise identity and uses the substitute history', async () => {
    const s = new Store();
    await s.init();
    // build push-up history first
    const t = s.templateById(BC_TPL_B)!;
    const idA = s.startWorkout(BC_TPL_B, '2026-08-20');
    const benchA = s.state.sessions.find((x) => x.id === idA)!.exercises[1];
    s.substituteExercise(idA, benchA.id, 'push-up', false);
    const pu = s.state.sessions.find((x) => x.id === idA)!.exercises[1];
    expect(pu).toMatchObject({ exerciseId: 'push-up', substitutedFor: 'Dumbbell Bench Press', weight: 0, bodyweight: true });
    for (let i = 0; i < 3; i++) s.logSet(idA, pu.id, i, 10);
    s.finishWorkout(idA);
    // template untouched by TODAY ONLY
    expect(s.templateById(BC_TPL_B)!.exercises[1].exerciseId).toBe('db-bench-press');
    // next B: bench suggestion is its own start weight (40), then substitute → push-up uses push-up history (0 + 2.5)
    const idB = s.startWorkout(BC_TPL_B, '2026-08-25');
    const benchB = s.state.sessions.find((x) => x.id === idB)!.exercises[1];
    expect(benchB.suggestedWeight).toBe(40);
    s.substituteExercise(idB, benchB.id, 'push-up', true);
    expect(s.state.sessions.find((x) => x.id === idB)!.exercises[1].suggestedWeight).toBe(2.5);
    expect(s.templateById(BC_TPL_B)!.exercises[1].exerciseId).toBe('push-up');
    expect(t.exercises[1].exerciseId).toBe('db-bench-press'); // old object untouched
  });

  it('stores an optional final-set RIR without affecting progression, and history edits recompute results', async () => {
    const s = new Store();
    await s.init();
    const id = s.startWorkout(BC_TPL_A, '2026-09-01');
    const es = s.state.sessions.find((x) => x.id === id)!.exercises[1]; // pull-up 3×5–8, targetRir 2
    expect(es.targetRir).toBe(2);
    for (let i = 0; i < 3; i++) s.logSet(id, es.id, i, 8);
    s.setFinalRir(id, es.id, 1);
    const done = s.finishWorkout(id)!;
    expect(done.exercises[1]).toMatchObject({ finalSetRir: 1, result: 'increase' });
    // clear it
    s.setFinalRir(id, es.id, undefined);
    expect('finalSetRir' in s.state.sessions.find((x) => x.id === id)!.exercises[1]).toBe(false);
    // history edit: drop a set below max → hold
    s.logSet(id, es.id, 2, 6);
    expect(s.state.sessions.find((x) => x.id === id)!.exercises[1].result).toBe('hold');
    await tick();
    expect((await loadAll()).sessions.find((x) => x.id === id)!.exercises[1].result).toBe('hold');
  });
});

describe('boxing', () => {
  it('one tap logs attendance; metadata can be added afterwards; missing metadata is fine', async () => {
    const s = new Store();
    await s.init();
    const rec = s.logBoxing('2026-09-01');
    expect(rec).toMatchObject({ date: '2026-09-01' });
    expect(rec.durationMin).toBeUndefined();
    expect(s.logBoxing('2026-09-01')).toBe(rec); // idempotent per day
    s.updateBoxing(rec.id, { sessionType: 'sparring', durationMin: 60 });
    s.updateBoxing(rec.id, { rpe: 8 });
    await tick();
    const stored = (await loadAll()).boxing[0];
    expect(stored).toMatchObject({ sessionType: 'sparring', durationMin: 60, rpe: 8 });
    s.updateBoxing(rec.id, { rpe: undefined });
    expect('rpe' in s.state.boxing[0]).toBe(false);
    s.undoBoxing('2026-09-01');
    expect(s.state.boxing).toHaveLength(0);
  });
});

describe('plan import', () => {
  it('adds a plan, templates and custom exercises without wiping anything', async () => {
    const raw = await seedV1();
    const s = new Store();
    await s.init();
    const before = { ...s.exportShape(), settings: s.state.settings };
    // a bundle from another device with a custom exercise and the cable leg curl
    const bundleText = JSON.stringify(buildPlanBundle(
      { id: 'plan_friend', name: 'FRIEND', mode: 'flex', weeklyGoals: [{ id: 'g1', kind: 'boxing', minimum: 2, target: 4 }, { id: 'g2', kind: 'rotation', templateIds: ['tpl_friend'], minimum: 1, target: 2 }] },
      [{ id: 'tpl_friend', name: 'FRIEND A', exercises: [{ id: 'te1', exerciseId: 'cable-leg-curl', sets: 2, repMin: 10, repMax: 15, restSec: 90, increment: 2.5, startWeight: 20 }, { id: 'te2', exerciseId: 'exc_custom', sets: 2, repMin: 8, repMax: 12, restSec: 60, increment: 2.5, startWeight: 0 }] }],
      [...EXERCISE_LIBRARY, { id: 'exc_custom', name: 'Landmine Press', category: 'Shoulders', equipment: 'other', custom: true }],
    ));
    const bundle = parsePlanBundle(bundleText, s.state.exercises.map((e) => e.id));
    const resolved = resolveBundle(bundle, { plans: s.state.plans, templates: s.state.templates, exercises: s.state.exercises });
    expect(resolved.exercises.map((e) => e.id)).toEqual(['exc_custom']); // cable-leg-curl already on device after migration
    const planId = await s.importPlanBundle(resolved);
    expect(planId).toBe('plan_friend');
    expect(s.state.settings.activePlanId).toBe(before.settings.activePlanId); // ACTIVATE is a separate, offered step
    expect(s.state.sessions).toEqual(raw.sessions);
    expect(s.state.boxing).toEqual(raw.boxing);
    expect(s.state.measurements).toEqual(raw.measurements);
    expect(s.state.settings).toEqual(before.settings);
    const stored = await loadAll();
    expect(stored.sessions).toEqual(raw.sessions);
    expect(stored.plans.some((p) => p.id === 'plan_friend')).toBe(true);
    expect(stored.templates.some((t) => t.id === 'tpl_friend')).toBe(true);
    expect(stored.exercises.some((e) => e.id === 'exc_custom')).toBe(true);
  });
});
