import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../src/store/store';
import { bulkPut, closeDB, getDB, loadAll, put } from '../src/lib/db';
import { PLAN_ID, SEED_MARKER, SEED_PLAN, SEED_TEMPLATES, TPL_LA, TPL_UA, TPL_UB } from '../src/data/seedPlan';
import { EXERCISE_LIBRARY } from '../src/data/exercises';
import { v3Backup } from './backup.test';
import { buildBackup, parseBackup } from '../src/lib/backup';
import { detectStall } from '../src/lib/stall';
import { applyCalibration } from '../src/lib/calibrate';
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

/** Write a realistic v3 install straight into IndexedDB (as the previous app left it). */
async function seedV3(overrides: { activePlanId?: string | null } = {}) {
  await getDB();
  const b = v3Backup();
  await bulkPut('exercises', b.exercises);
  await bulkPut('templates', b.templates);
  await bulkPut('plans', b.plans);
  await bulkPut('sessions', b.sessions);
  await bulkPut('boxing', b.boxing);
  await bulkPut('measurements', b.measurements);
  await put('settings', { ...b.settings, ...(overrides.activePlanId !== undefined ? { activePlanId: overrides.activePlanId } : {}) });
  return b;
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const sessionOf = (s: Store, id: string) => s.state.sessions.find((x) => x.id === id)!;

beforeEach(wipe);
afterEach(async () => {
  await closeDB();
});

describe('fresh install', () => {
  it('seeds the library and the program exactly once', async () => {
    const s = new Store();
    await s.init();
    expect(s.state.plans.map((p) => p.id)).toEqual([PLAN_ID]);
    expect(s.state.templates).toHaveLength(SEED_TEMPLATES.length);
    expect(s.state.exercises).toHaveLength(EXERCISE_LIBRARY.length);
    expect(s.state.exercises.find((e) => e.id === 'pull-up')).toMatchObject({ progressionId: 'pull', level: 3 });
    expect(s.state.exercises.find((e) => e.id === 'tuck-front-lever')).toMatchObject({ progressionId: 'frontlever', timed: true });
    expect(s.state.settings).toMatchObject({ schemaVersion: SCHEMA_VERSION, onboarded: false, seedMarkers: [SEED_MARKER] });
    const s2 = new Store();
    await s2.init();
    expect(s2.state.plans).toHaveLength(1);
    expect(s2.state.templates).toHaveLength(SEED_TEMPLATES.length);
    s2.completeOnboarding(PLAN_ID);
    expect(s2.activePlan()?.id).toBe(PLAN_ID);
  });

  it('calibration rewrites starting rungs on the seeded templates', async () => {
    const s = new Store();
    await s.init();
    for (const t of applyCalibration(s.state.templates, { pull: '0', push: '0-4', squat: 'squats', bands: false })) s.saveTemplate(t);
    const id = s.startWorkout(TPL_UA, '2026-09-01');
    expect(sessionOf(s, id).exercises[0]).toMatchObject({ exerciseId: 'negative-pull-up', variationBasis: 'start', level: 1 });
    expect(sessionOf(s, id).exercises[1]).toMatchObject({ exerciseId: 'incline-push-up', level: 0 });
  });
});

describe('upgrading a v3 install', () => {
  it('keeps history and measurements, resyncs the library, swaps the legacy program for the new one, and activates it', async () => {
    const raw = await seedV3();
    const s = new Store();
    await s.init();
    expect(s.state.sessions).toEqual(raw.sessions);
    expect(s.state.measurements).toEqual(raw.measurements);
    // library: gym rows and retired rungs gone, library rows refreshed, custom rows untouched
    expect(s.state.exercises.some((e) => e.id === 'db-bench-press')).toBe(false);
    expect(s.state.exercises.some((e) => e.id === 'mike-tyson-push-up')).toBe(false);
    expect(s.state.exercises.find((e) => e.id === 'pull-up')).toEqual(EXERCISE_LIBRARY.find((e) => e.id === 'pull-up'));
    expect(s.state.exercises.find((e) => e.id === 'ex_custom')).toMatchObject({ name: 'Towel Row', custom: true });
    expect(s.state.exercises.filter((e) => !e.custom)).toHaveLength(EXERCISE_LIBRARY.length);
    // plans: fixed plan and legacy flex plans removed, program added and active
    expect(s.state.plans.map((p) => p.id)).toEqual([PLAN_ID]);
    expect(s.state.templates.map((t) => t.id).sort()).toEqual(SEED_TEMPLATES.map((t) => t.id).sort());
    expect(s.state.settings).toMatchObject({ activePlanId: PLAN_ID, schemaVersion: SCHEMA_VERSION, onboarded: true, startDate: '2026-10-10' });
    expect(s.state.settings.seedMarkers).toContain(SEED_MARKER);
    // the pull-up chain picks up from the old history: 6,5,5 hit the floor targets → 7,6,6 next
    const id = s.startWorkout(TPL_UA, '2026-10-25');
    expect(sessionOf(s, id).exercises[0]).toMatchObject({ exerciseId: 'pull-up', variationBasis: 'hold', targetReps: [7, 6, 6] });
    // the retired rung's exposure is simply not part of the push chain any more
    expect(sessionOf(s, id).exercises[1]).toMatchObject({ exerciseId: 'push-up', variationBasis: 'start' });
    // second boot: nothing duplicated, nothing re-added
    s.deletePlan(PLAN_ID);
    await tick();
    const s2 = new Store();
    await s2.init();
    expect(s2.state.plans).toHaveLength(0);
    expect(s2.state.templates.filter((t) => t.id === TPL_UA)).toHaveLength(1);
  });

  it('a user-made plan stays active; the program is still added', async () => {
    await seedV3({ activePlanId: 'plan_mine' });
    await put('plans', { id: 'plan_mine', name: 'Mine', mode: 'flex', weeklyGoals: [{ id: 'g', kind: 'rotation', templateIds: ['tpl_cc_upper_a'], minimum: 1, target: 2 }] });
    const s = new Store();
    await s.init();
    expect(s.state.settings.activePlanId).toBe('plan_mine');
    expect(s.state.plans.map((p) => p.id).sort()).toEqual(['plan_bar_strength', 'plan_mine']);
  });

  it('an old backup imports through the full restore path and gets the same migration', async () => {
    const s = new Store();
    await s.init();
    await s.importBackup(parseBackup(JSON.stringify(v3Backup())));
    expect(s.state.sessions).toEqual(v3Backup().sessions);
    expect(s.state.plans.map((p) => p.id)).toEqual([PLAN_ID]);
    expect(s.state.settings.activePlanId).toBe(PLAN_ID);
    const again = parseBackup(JSON.stringify(buildBackup(s.exportShape())));
    expect(again.templates.find((t) => t.id === TPL_UA)?.warmup?.length).toBeGreaterThan(0);
  });
});

describe('sessions are immutable snapshots', () => {
  it('editing a template never rewrites past workouts', async () => {
    const s = new Store();
    await s.init();
    const id = s.startWorkout(TPL_UA, '2026-09-01');
    const es = sessionOf(s, id).exercises[0];
    for (let i = 0; i < 3; i++) s.logSet(id, es.id, i, 8);
    s.finishWorkout(id);
    const before = JSON.stringify(sessionOf(s, id));
    const tpl = s.templateById(TPL_UA)!;
    s.saveTemplate({ ...tpl, exercises: tpl.exercises.map((te) => ({ ...te, sets: 5, repMax: 20 })) });
    await tick();
    expect(JSON.stringify(sessionOf(s, id))).toBe(before);
    const stored = (await loadAll()).sessions.find((x) => x.id === id)!;
    expect(stored.exercises[0].targetSets).toBe(3);
    expect(stored.exercises[0].result).toBe('increase');
  });

  it('finishing early marks incomplete and never triggers a step back; extra sets do not decide', async () => {
    const s = new Store();
    await s.init();
    const id = s.startWorkout(TPL_UA, '2026-09-01');
    const [pull, push] = sessionOf(s, id).exercises;
    for (let i = 0; i < 3; i++) s.logSet(id, pull.id, i, 8);
    s.addSet(id, pull.id);
    s.logSet(id, pull.id, 3, 2); // bonus set, terrible reps
    s.logSet(id, push.id, 0, 2); // one set, below range
    const done = s.finishWorkout(id)!;
    expect(done.exercises[0].result).toBe('increase');
    expect(done.exercises[1].result).toBe('incomplete');
    const id2 = s.startWorkout(TPL_UA, '2026-09-04');
    expect(sessionOf(s, id2).exercises[0]).toMatchObject({ exerciseId: 'archer-pull-up', variationBasis: 'advance' });
    expect(sessionOf(s, id2).exercises[1]).toMatchObject({ exerciseId: 'push-up', variationBasis: 'hold' });
  });

  it('history edits recompute results and persist', async () => {
    const s = new Store();
    await s.init();
    const id = s.startWorkout(TPL_UA, '2026-09-01');
    const es = sessionOf(s, id).exercises[0];
    for (let i = 0; i < 3; i++) s.logSet(id, es.id, i, 8);
    expect(s.finishWorkout(id)!.exercises[0].result).toBe('increase');
    s.logSet(id, es.id, 2, 6);
    expect(sessionOf(s, id).exercises[0].result).toBe('hold');
    await tick();
    expect((await loadAll()).sessions.find((x) => x.id === id)!.exercises[0].result).toBe('hold');
  });
});

describe('progression by variation (chains)', () => {
  it('Upper A starts on the template rungs, pairs antagonists, and carries warm-up + cues', async () => {
    const s = new Store();
    await s.init();
    const id = s.startWorkout(TPL_UA, '2026-09-01');
    const ses = sessionOf(s, id);
    expect(ses.warmup?.length).toBeGreaterThan(0);
    const [pull, push, pike, row, fl, pl, core] = ses.exercises;
    expect(pull).toMatchObject({ exerciseId: 'pull-up', progressionId: 'pull', variationBasis: 'start', weight: 0, slotId: 'ua_0_pull-up', level: 3, levelCount: 9 });
    expect(pull.cue).toMatch(/Dead-hang/);
    expect(pull.gear).toBe('pull-up bar');
    expect(push.pairGroup).toBe(pull.pairGroup);
    expect(pike.pairGroup).toBeDefined();
    expect(pike.pairGroup).not.toBe(pull.pairGroup);
    expect(row.pairGroup).toBe(pike.pairGroup);
    expect(fl).toMatchObject({ exerciseId: 'tuck-front-lever', timed: true, targetReps: [10, 10, 10] });
    expect(pl.pairGroup).toBe(fl.pairGroup);
    expect(core.pairGroup).toBeUndefined();
  });

  it('hitting the rep ceiling on every set advances to the next rung; a hold stays; the top rung adds load', async () => {
    const s = new Store();
    await s.init();
    let id = s.startWorkout(TPL_UA, '2026-09-01');
    let push = sessionOf(s, id).exercises[1];
    for (let i = 0; i < 3; i++) s.logSet(id, push.id, i, 8);
    expect(s.finishWorkout(id)!.exercises[1].result).toBe('increase');
    // Upper B also has the push chain at the same range: diamond push-up, basis advance
    id = s.startWorkout(TPL_UB, '2026-09-03');
    push = sessionOf(s, id).exercises[3];
    expect(push).toMatchObject({ exerciseId: 'diamond-push-up', variationBasis: 'advance', fromExerciseId: 'push-up', fromName: 'Push-up', level: 2, weight: 0, targetReps: [5, 5, 5] });
    s.logSet(id, push.id, 0, 8);
    s.logSet(id, push.id, 1, 8);
    s.logSet(id, push.id, 2, 6);
    s.finishWorkout(id);
    id = s.startWorkout(TPL_UA, '2026-09-05');
    push = sessionOf(s, id).exercises[1];
    expect(push).toMatchObject({ exerciseId: 'diamond-push-up', variationBasis: 'hold', targetReps: [8, 8, 7] });
    s.abortWorkout(id);
    // top of chain by hand, max it, next time it is 'top' and the backpack suggestion steps up
    id = s.startWorkout(TPL_UA, '2026-09-07');
    push = sessionOf(s, id).exercises[1];
    for (let k = 0; k < 10; k++) s.shiftVariation(id, push.id, 1);
    push = sessionOf(s, id).exercises[1];
    expect(push).toMatchObject({ exerciseId: 'one-arm-push-up', variationBasis: 'manual', level: 7, levelCount: 8 });
    for (let i = 0; i < 3; i++) s.logSet(id, push.id, i, 8);
    s.finishWorkout(id);
    id = s.startWorkout(TPL_UA, '2026-09-09');
    expect(sessionOf(s, id).exercises[1]).toMatchObject({ exerciseId: 'one-arm-push-up', variationBasis: 'top', weight: 5, suggestedWeight: 5, targetReps: [5, 5, 5] });
  });

  it('two consecutive below-range exposures step back one rung; stepping down by hand sticks', async () => {
    const s = new Store();
    await s.init();
    const below = (date: string) => {
      const id = s.startWorkout(TPL_UA, date);
      const pull = sessionOf(s, id).exercises[0];
      for (let i = 0; i < 3; i++) s.logSet(id, pull.id, i, 3);
      s.finishWorkout(id);
    };
    below('2026-09-01');
    let id = s.startWorkout(TPL_UA, '2026-09-03');
    expect(sessionOf(s, id).exercises[0]).toMatchObject({ exerciseId: 'pull-up', variationBasis: 'hold' });
    s.abortWorkout(id);
    below('2026-09-03');
    id = s.startWorkout(TPL_UA, '2026-09-05');
    expect(sessionOf(s, id).exercises[0]).toMatchObject({ exerciseId: 'band-assisted-pull-up', variationBasis: 'regress', fromExerciseId: 'pull-up' });
    s.abortWorkout(id);
    id = s.startWorkout(TPL_UA, '2026-09-07');
    let pull = sessionOf(s, id).exercises[0];
    s.shiftVariation(id, pull.id, -1);
    pull = sessionOf(s, id).exercises[0];
    expect(pull.exerciseId).toBe('negative-pull-up');
    for (let i = 0; i < 3; i++) s.logSet(id, pull.id, i, 6);
    s.finishWorkout(id);
    id = s.startWorkout(TPL_UA, '2026-09-09');
    expect(sessionOf(s, id).exercises[0]).toMatchObject({ exerciseId: 'negative-pull-up', variationBasis: 'hold' });
  });

  it('a locked slot never follows the chain; timed rungs advance in seconds; "replace in plan" targets the slot', async () => {
    const s = new Store();
    await s.init();
    const tpl = s.templateById(TPL_LA)!;
    s.saveTemplate({ ...tpl, exercises: tpl.exercises.map((te, i) => (i === 0 ? { ...te, lockVariation: true } : te)) });
    let id = s.startWorkout(TPL_LA, '2026-09-01');
    let ses = sessionOf(s, id);
    expect(ses.exercises[0].progressionId).toBeUndefined();
    expect(ses.exercises[4]).toMatchObject({ exerciseId: 'hollow-body-hold', timed: true, progressionId: 'lsit', targetReps: [15, 15, 15] });
    for (let i = 0; i < 4; i++) s.logSet(id, ses.exercises[0].id, i, 8);
    for (let i = 0; i < 3; i++) s.logSet(id, ses.exercises[4].id, i, 30);
    s.finishWorkout(id);
    id = s.startWorkout(TPL_LA, '2026-09-03');
    ses = sessionOf(s, id);
    expect(ses.exercises[0].exerciseId).toBe('bulgarian-split-squat-bw');
    expect(ses.exercises[4]).toMatchObject({ exerciseId: 'tuck-l-sit', variationBasis: 'advance', timed: true, targetReps: [15, 15, 15] });
    s.substituteExercise(id, ses.exercises[4].id, 'dead-hang', true);
    expect(s.templateById(TPL_LA)!.exercises[4].exerciseId).toBe('dead-hang');
    expect(sessionOf(s, id).exercises[4]).toMatchObject({ exerciseId: 'dead-hang', substitutedFor: 'Tuck L-sit', timed: true });
    expect(sessionOf(s, id).exercises[4].progressionId).toBeUndefined();
  });
});

describe('exact rep targets', () => {
  it('starts at the floor, climbs +1 per set while targets are hit, resets at the floor on a new rung or load, and previews without side effects', async () => {
    const s = new Store();
    await s.init();
    const pv = s.previewWorkout(TPL_UA);
    expect(pv[0].targetReps).toEqual([5, 5, 5]);
    expect(pv[0].pairGroup).toBe(pv[1].pairGroup);
    expect(s.state.sessions).toHaveLength(0);

    let id = s.startWorkout(TPL_UA, '2026-09-01');
    let pull = sessionOf(s, id).exercises[0];
    for (let i = 0; i < 3; i++) s.logSet(id, pull.id, i, 5);
    s.finishWorkout(id);

    id = s.startWorkout(TPL_UA, '2026-09-03');
    pull = sessionOf(s, id).exercises[0];
    expect(pull.targetReps).toEqual([6, 6, 6]);
    s.logSet(id, pull.id, 0, 6);
    s.logSet(id, pull.id, 1, 6);
    s.logSet(id, pull.id, 2, 5);
    s.finishWorkout(id);

    id = s.startWorkout(TPL_UA, '2026-09-05');
    pull = sessionOf(s, id).exercises[0];
    expect(pull.targetReps).toEqual([6, 6, 6]);
    for (let i = 0; i < 3; i++) s.logSet(id, pull.id, i, 8);
    s.finishWorkout(id);

    id = s.startWorkout(TPL_UA, '2026-09-07');
    pull = sessionOf(s, id).exercises[0];
    expect(pull).toMatchObject({ exerciseId: 'archer-pull-up', variationBasis: 'advance', targetReps: [5, 5, 5] });
    s.shiftVariation(id, pull.id, -1);
    expect(sessionOf(s, id).exercises[0]).toMatchObject({ exerciseId: 'pull-up', targetReps: [8, 8, 8] });
    s.setExerciseWeight(id, sessionOf(s, id).exercises[0].id, 10);
    expect(sessionOf(s, id).exercises[0].targetReps).toEqual([5, 5, 5]);
  });
});

describe('stalls and deloads', () => {
  it('three flat sessions flag a stall; a deload resets targets to the floor, never advances, and restarts the climb one above the floor', async () => {
    const s = new Store();
    await s.init();
    const flat = (date: string) => {
      const id = s.startWorkout(TPL_UA, date);
      const pull = sessionOf(s, id).exercises[0];
      s.logSet(id, pull.id, 0, 6);
      s.logSet(id, pull.id, 1, 6);
      s.logSet(id, pull.id, 2, 5);
      s.finishWorkout(id);
    };
    flat('2026-09-01');
    flat('2026-09-03');
    expect(detectStall(s.state.sessions, 'pull-up', 0)).toBeNull();
    flat('2026-09-05');
    expect(detectStall(s.state.sessions, 'pull-up', 0)).toEqual({ sessions: 3, from: 17, to: 17 });

    let id = s.startWorkout(TPL_UA, '2026-09-07');
    let pull = sessionOf(s, id).exercises[0];
    expect(pull.targetReps).toEqual([6, 6, 6]); // the engine keeps asking for the same thing; the UI offers the deload
    s.setDeload(id, pull.id, true);
    pull = sessionOf(s, id).exercises[0];
    expect(pull).toMatchObject({ deload: true, targetReps: [5, 5, 5] });
    s.setDeload(id, pull.id, false);
    expect(sessionOf(s, id).exercises[0].targetReps).toEqual([6, 6, 6]);
    expect(sessionOf(s, id).exercises[0].deload).toBeUndefined();
    s.setDeload(id, pull.id, true);
    for (let i = 0; i < 3; i++) s.logSet(id, pull.id, i, 8); // felt great, did the ceiling anyway
    const done = s.finishWorkout(id)!;
    expect(done.exercises[0].result).toBe('hold'); // a deload can never advance the chain

    id = s.startWorkout(TPL_UA, '2026-09-09');
    pull = sessionOf(s, id).exercises[0];
    expect(pull).toMatchObject({ exerciseId: 'pull-up', variationBasis: 'hold', targetReps: [6, 6, 6] });
    expect(pull.deload).toBeUndefined();
    expect(detectStall(s.state.sessions, 'pull-up', 0)).toBeNull(); // window restarted
  });

  it('stepping down a rung is the other way out, and shifting clears a pending deload', async () => {
    const s = new Store();
    await s.init();
    const id = s.startWorkout(TPL_UA, '2026-09-01');
    const pull = sessionOf(s, id).exercises[0];
    s.setDeload(id, pull.id, true);
    s.shiftVariation(id, pull.id, -1);
    expect(sessionOf(s, id).exercises[0]).toMatchObject({ exerciseId: 'band-assisted-pull-up', targetReps: [5, 5, 5] });
    expect(sessionOf(s, id).exercises[0].deload).toBeUndefined();
  });
});

describe('program edits', () => {
  it('restoring the default program rewrites templates and plan but leaves history alone', async () => {
    const s = new Store();
    await s.init();
    const id = s.startWorkout(TPL_UA, '2026-09-01');
    s.logSet(id, sessionOf(s, id).exercises[0].id, 0, 8);
    s.finishWorkout(id);
    const tpl = s.templateById(TPL_UA)!;
    s.saveTemplate({ ...tpl, name: 'My upper', exercises: tpl.exercises.slice(0, 2) });
    s.savePlan({ ...SEED_PLAN, name: 'Mine', weeklyGoals: SEED_PLAN.weeklyGoals.slice(0, 1) });
    s.restoreDefaultProgram();
    await tick();
    expect(s.templateById(TPL_UA)).toEqual(SEED_TEMPLATES.find((t) => t.id === TPL_UA));
    expect(s.activePlan()).toEqual(SEED_PLAN);
    expect(s.state.sessions).toHaveLength(1);
    expect((await loadAll()).templates.find((t) => t.id === TPL_UA)?.name).toBe('Upper A');
  });

  it('deleting a template removes it from the rotation; measurements are one per day', async () => {
    const s = new Store();
    await s.init();
    s.completeOnboarding(PLAN_ID);
    s.deleteTemplate(TPL_UB);
    const rot = s.activePlan()!.weeklyGoals.find((g) => g.kind === 'rotation')!;
    expect(rot.kind === 'rotation' && rot.templateIds).toEqual([TPL_UA, TPL_LA, 'tpl_bs_lower_b']);
    s.addMeasurement('2026-09-01', 180, 34);
    s.addMeasurement('2026-09-01', 179.5);
    expect(s.state.measurements).toHaveLength(1);
    expect(s.state.measurements[0]).toMatchObject({ weightLb: 179.5, waistIn: 34 });
  });
});
