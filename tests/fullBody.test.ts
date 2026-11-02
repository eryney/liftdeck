import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../src/store/store';
import { bulkPut, closeDB, defaultSettings, put } from '../src/lib/db';
import { FULL_BODY_MARKER, FULL_BODY_PLAN, TPL_FA, TPL_FB, TPL_ACCESSORY, TPL_CARDIO } from '../src/data/fullBodyPlan';
import { BAND_ROWS_MARKER, SEED_MARKER, SPLIT_PLAN, SPLIT_TEMPLATES, TPL_UA } from '../src/data/seedPlan';
import { HOME_SETUP_MARKER } from '../src/data/homeSetup';
import { EXERCISE_LIBRARY } from '../src/data/exercises';
import { recommend } from '../src/lib/recommend';
import { buildBackup, parseBackup, sessionsToCSV } from '../src/lib/backup';
import type { WorkoutSession } from '../src/types';

const tick = () => new Promise((r) => setTimeout(r, 0));
const at = (date: string, hour = 18) => new Date(`${date}T${hour}:00:00`).getTime();
function ws(date: string, templateId: string): WorkoutSession {
  return { id: `${date}-${templateId}`, date, templateId, name: templateId, status: 'completed', startedAt: at(date, 10), finishedAt: at(date, 11), exercises: [] };
}
function rec(sessions: WorkoutSession[], today: string) {
  return recommend({ plan: FULL_BODY_PLAN, sessions, today, now: at(today) });
}

beforeEach(async () => {
  await closeDB();
  await new Promise<void>((resolve, reject) => {
    const r = indexedDB.deleteDatabase('liftdeck');
    r.onsuccess = () => resolve(); r.onerror = () => reject(r.error);
  });
});
afterEach(closeDB);

describe('full-body schedule', () => {
  it('leaves a whole recovery day, even after 24 hours have elapsed', () => {
    const sessions = [ws('2026-11-02', TPL_FA)];
    expect(rec(sessions, '2026-11-03').primary).toMatchObject({ kind: 'rest' });
    expect(rec(sessions, '2026-11-03').primary.reason).toContain('Recovery day');
    expect(rec(sessions, '2026-11-04').primary).toMatchObject({ kind: 'strength', templateId: TPL_FB });
  });

  it('stops recommending strength at three sessions and carries the A/B rotation across weeks', () => {
    const sessions = [ws('2026-11-02', TPL_FA), ws('2026-11-04', TPL_FB), ws('2026-11-06', TPL_FA)];
    expect(rec(sessions, '2026-11-08')).toMatchObject({ primary: { kind: 'rest' }, strength: { count: 3 }, targetMet: true });
    expect(rec(sessions, '2026-11-09')).toMatchObject({ primary: { kind: 'strength', templateId: TPL_FB }, strength: { count: 0 } });
  });

  it('shares the optional cap across both activities without changing recovery or the rotation', () => {
    const sessions = [ws('2026-11-02', TPL_FA), ws('2026-11-03', TPL_ACCESSORY), { ...ws('2026-11-04', TPL_CARDIO), cardio: { activity: 'Cycle', minutes: 30 } }];
    expect(rec(sessions, '2026-11-04')).toMatchObject({ primary: { kind: 'strength', templateId: TPL_FB }, strength: { count: 1 }, optional: { count: 2, max: 2, visible: false } });
  });
});

describe('full-body migration and optional logs', () => {
  it('preserves calibrated rungs, completed history and an active workout, then migrates only once', async () => {
    await bulkPut('exercises', EXERCISE_LIBRARY);
    const oldTemplates = structuredClone(SPLIT_TEMPLATES);
    oldTemplates[0].exercises[0].exerciseId = 'negative-pull-up';
    await bulkPut('templates', oldTemplates);
    await put('plans', SPLIT_PLAN);
    await put('settings', { ...defaultSettings(), activePlanId: SPLIT_PLAN.id, onboarded: true, seedMarkers: [SEED_MARKER, BAND_ROWS_MARKER, HOME_SETUP_MARKER] });
    const old = new Store();
    // Construct realistic snapshots before the new migration runs.
    old.state = { ...old.state, templates: oldTemplates, exercises: EXERCISE_LIBRARY };
    const completedId = old.startWorkout(TPL_UA, '2026-11-01');
    old.logSet(completedId, old.state.sessions[0].exercises[0].id, 0, 5);
    old.finishWorkout(completedId);
    old.startWorkout(TPL_UA, '2026-11-02');
    await tick();
    const snapshots = structuredClone(old.state.sessions);
    const upgraded = new Store();
    await upgraded.init();
    expect(upgraded.activePlan()).toEqual(FULL_BODY_PLAN);
    expect(upgraded.state.sessions).toEqual(snapshots);
    expect(upgraded.templateById(TPL_UA)?.archived).toBe(true);
    expect(upgraded.templateById(TPL_FA)?.exercises[0].exerciseId).toBe('negative-pull-up');
    expect(upgraded.state.settings.seedMarkers).toContain(FULL_BODY_MARKER);
    upgraded.saveTemplate({ ...upgraded.templateById(TPL_FA)!, name: 'My A' });
    await tick();
    const again = new Store(); await again.init();
    expect(again.templateById(TPL_FA)?.name).toBe('My A');
    expect(again.state.sessions).toEqual(snapshots);
  });

  it('saves cardio minutes through reload, backup restore and CSV export', async () => {
    const s = new Store(); await s.init();
    await expect(s.logCardio(0.5, 'Run')).rejects.toThrow();
    expect(() => s.startWorkout(TPL_CARDIO)).toThrow(/cardio log/);
    const id = await s.logCardio(30, 'Cycle', '2026-11-03');
    await tick();
    const again = new Store(); await again.init();
    const logged = again.state.sessions.find((x) => x.id === id)!;
    expect(logged).toMatchObject({ status: 'completed', exercises: [], cardio: { activity: 'Cycle', minutes: 30 } });
    await again.importBackup(parseBackup(JSON.stringify(buildBackup(again.exportShape()))));
    expect(again.state.sessions.find((x) => x.id === id)).toEqual(logged);
    const row = sessionsToCSV([logged]).split('\n')[1].split(',');
    expect(row).toHaveLength(14);
    expect(row.slice(-2)).toEqual(['Cycle', '30']);
  });

  it('accessory logs stay optional after the optional goal is disabled', async () => {
    const s = new Store(); await s.init();
    const id = s.startWorkout(TPL_ACCESSORY, '2026-11-03');
    s.finishWorkout(id);
    const plan = { ...FULL_BODY_PLAN, weeklyGoals: FULL_BODY_PLAN.weeklyGoals.slice(0, 1) };
    const r = recommend({ plan, sessions: s.state.sessions, today: '2026-11-03', now: Date.now() });
    expect(r.primary).toMatchObject({ kind: 'strength', templateId: TPL_FA });
    await tick();
  });

  it('deleting an optional template retains its remaining alternative without dangling references', async () => {
    const s = new Store(); await s.init();
    s.completeOnboarding(FULL_BODY_PLAN.id);
    s.deleteTemplate(TPL_ACCESSORY);
    expect(s.activePlan()?.weeklyGoals[1]).toMatchObject({ templateId: TPL_CARDIO, alternativeTemplateIds: [] });
    s.deleteTemplate(TPL_CARDIO);
    expect(s.activePlan()?.weeklyGoals).toHaveLength(1);
    await tick();
  });
});
