import { describe, expect, it } from 'vitest';
import { buildBackup, measurementsToCSV, parseBackup, sessionsToCSV } from '../src/lib/backup';
import { defaultSettings } from '../src/lib/db';
import { migrateSettings, normalizePlans } from '../src/lib/migrate';
import { SCHEMA_VERSION } from '../src/types';
import type { WorkoutSession } from '../src/types';

const shape = {
  settings: defaultSettings(),
  exercises: [],
  templates: [],
  plans: [],
  sessions: [] as WorkoutSession[],
  measurements: [{ id: 'm1', date: '2026-08-01', weightLb: 180.5, loggedAt: 1 }],
};

/** A realistic v3 backup as the previous app wrote it: boxing records, a fixed v1 plan, gym rows, RIR fields. */
export function v3Backup() {
  const session: WorkoutSession = {
    id: 'ws_old',
    date: '2026-10-15',
    name: 'UPPER A',
    templateId: 'tpl_cc_upper_a',
    status: 'completed',
    startedAt: 1760540000000,
    finishedAt: 1760543000000,
    exercises: [
      {
        id: 'es_old', exerciseId: 'pull-up', name: 'Pull-Up', bodyweight: true, targetSets: 3, repMin: 5, repMax: 8, restSec: 75, increment: 5,
        suggestedWeight: 0, weight: 0, result: 'hold', targetRir: 2, finalSetRir: 1, progressionId: 'pull', level: 3, levelCount: 7, variationBasis: 'start',
        targetReps: [5, 5, 5],
        sets: [{ reps: 6, weight: 0, loggedAt: 1 }, { reps: 5, weight: 0, loggedAt: 2 }, { reps: 5, weight: 0, loggedAt: 3 }],
      },
      {
        id: 'es_old2', exerciseId: 'mike-tyson-push-up', name: 'Mike Tyson Push-Up', bodyweight: true, targetSets: 3, repMin: 8, repMax: 12, restSec: 75, increment: 5,
        suggestedWeight: 0, weight: 0, result: 'increase', progressionId: 'push', level: 3, levelCount: 9, variationBasis: 'manual',
        sets: [{ reps: 12, weight: 0 }, { reps: 12, weight: 0 }, { reps: 12, weight: 0 }],
      },
    ],
  };
  return {
    app: 'liftdeck',
    schemaVersion: 3,
    exportedAt: '2026-10-20T10:00:00.000Z',
    settings: {
      id: 'settings', schemaVersion: 3, onboarded: true, activePlanId: 'plan_calisthenics_cut_flex', startDate: '2026-10-10', units: 'lb',
      defaultIncrement: 5, compoundRestSec: 120, isolationRestSec: 90, maWindowDays: 7, soundOn: true, vibrateOn: true, askRir: false,
      goalMode: 'cut', goalDate: '2027-03-31', seedMarkers: ['boxer-cut-flex-v1', 'calisthenics-cut-v1'],
    },
    exercises: [
      { id: 'db-bench-press', name: 'Dumbbell Bench Press', category: 'Chest', equipment: 'dumbbell', perHand: true, compound: true },
      { id: 'pull-up', name: 'Pull-Up', category: 'Back', equipment: 'bodyweight', bodyweight: true, compound: true, progressionId: 'pull', level: 3, cue: 'old cue' },
      { id: 'mike-tyson-push-up', name: 'Mike Tyson Push-Up', category: 'Chest', equipment: 'bodyweight', bodyweight: true, progressionId: 'push', level: 3, cue: 'x' },
      { id: 'ex_custom', name: 'Towel Row', category: 'Back', equipment: 'other', custom: true },
    ],
    templates: [{ id: 'tpl_cc_upper_a', name: 'UPPER A', exercises: [{ id: 'cua_0_pull-up', exerciseId: 'pull-up', sets: 3, repMin: 5, repMax: 8, restSec: 75, increment: 5, startWeight: 0, targetRir: 2, superset: true }] }],
    plans: [
      { id: 'plan_default', name: 'PROGRAM 01', schedule: [{ type: 'boxing' }, { type: 'workout', templateId: 'tpl_strength_a' }] },
      { id: 'plan_boxer_cut_flex', name: 'BOXER CUT', mode: 'flex', weeklyGoals: [{ id: 'goal_boxing', kind: 'boxing', minimum: 2, target: 4 }, { id: 'goal_strength', kind: 'rotation', templateIds: ['tpl_bc_strength_a'], minimum: 1, target: 2 }] },
      { id: 'plan_calisthenics_cut_flex', name: 'CALISTHENICS CUT', mode: 'flex', weeklyGoals: [{ id: 'goal_strength', kind: 'rotation', templateIds: ['tpl_cc_upper_a'], minimum: 3, target: 4, max: 5, minGapHours: 20 }] },
    ],
    sessions: [session],
    boxing: [{ id: 'bx_old', date: '2026-10-14', loggedAt: 1760440000000, sessionType: 'sparring' }],
    measurements: [{ id: 'bm_old', date: '2026-10-14', weightLb: 184.2, waistIn: 35.5, loggedAt: 1760440000000 }],
  };
}

describe('backup roundtrip', () => {
  it('export → parse reconstructs the data at the current schema version', () => {
    const backup = buildBackup(shape);
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION);
    expect('boxing' in backup).toBe(false);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.measurements).toEqual(shape.measurements);
    expect(parsed.settings.units).toBe('lb');
  });

  it('rejects non-liftdeck files and newer schema versions', () => {
    expect(() => parseBackup('{"app":"other"}')).toThrow();
    expect(() => parseBackup('not json')).toThrow();
    const backup = { ...buildBackup(shape), schemaVersion: 999 };
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/newer/);
  });
});

describe('older backups', () => {
  it('a v3 backup imports: boxing dropped, fixed plans dropped, boxing goals stripped, history byte-identical', () => {
    const raw = v3Backup();
    const parsed = parseBackup(JSON.stringify(raw));
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.settings.schemaVersion).toBe(SCHEMA_VERSION);
    expect('boxing' in parsed).toBe(false);
    expect(parsed.sessions).toEqual(raw.sessions);
    expect(parsed.measurements).toEqual(raw.measurements);
    expect(parsed.plans.map((p) => p.id)).toEqual(['plan_boxer_cut_flex', 'plan_calisthenics_cut_flex']);
    expect(parsed.plans[0].weeklyGoals.map((g) => g.kind)).toEqual(['rotation']);
    // the store's migration decides what to do with legacy plans; parse just keeps them valid
    expect(parsed.settings.activePlanId).toBe('plan_calisthenics_cut_flex');
    // legacy settings keys are harmless extras; the known ones survive
    expect(parsed.settings).toMatchObject({ startDate: '2026-10-10', soundOn: true, maWindowDays: 7 });
  });

  it('a v1 backup without measurements or mode-less plans still parses', () => {
    const b = { ...v3Backup(), schemaVersion: 1, plans: [{ id: 'plan_default', name: 'PROGRAM 01', schedule: [] }], measurements: undefined };
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.plans).toEqual([]);
    expect(parsed.measurements).toEqual([]);
  });

  it('migrateSettings fills defaults without overriding values; normalizePlans drops junk', () => {
    const s = migrateSettings({ id: 'settings', schemaVersion: 1, onboarded: true, activePlanId: 'x', startDate: '2026-01-01', units: 'kg', maWindowDays: 5, soundOn: false, vibrateOn: false });
    expect(s).toMatchObject({ schemaVersion: SCHEMA_VERSION, activePlanId: 'x', units: 'kg', maWindowDays: 5, soundOn: false, seedMarkers: [] });
    expect(migrateSettings({ units: 'stone' as any, maWindowDays: 0 })).toMatchObject({ units: 'lb', maWindowDays: 7 });
    expect(normalizePlans([null, {}, { id: 'a', mode: 'flex', weeklyGoals: 'nope' }, { id: 'b', name: 'B', mode: 'flex', weeklyGoals: [{ id: 'g', kind: 'boxing', minimum: 1, target: 1 }] }])).toEqual([{ id: 'b', name: 'B', mode: 'flex', weeklyGoals: [] }]);
  });
});

describe('csv', () => {
  it('renders measurements', () => {
    expect(measurementsToCSV(shape.measurements)).toBe('date,weight_lb,waist_in\n2026-08-01,180.5,');
  });

  it('renders only logged sets of completed sessions, with chain rung, extra sets and deloads flagged', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 'w1', date: '2026-09-01', name: 'Upper A', status: 'completed', startedAt: 1,
        exercises: [{
          id: 'e1', exerciseId: 'pull-up', name: 'Pull-up', bodyweight: true, targetSets: 2, repMin: 5, repMax: 8, restSec: 90, increment: 5, suggestedWeight: 0, weight: 0,
          progressionId: 'pull', level: 3, targetReps: [5, 5], result: 'hold', deload: true,
          sets: [{ reps: 5, weight: 0 }, { reps: 5, weight: 0 }, { reps: 3, weight: 0 }, { reps: null, weight: 0 }],
        }],
      },
      { id: 'w2', date: '2026-09-02', name: 'Lower A', status: 'active', startedAt: 2, exercises: [{ id: 'e2', exerciseId: 'x', name: 'X', targetSets: 1, repMin: 5, repMax: 8, restSec: 60, increment: 5, suggestedWeight: 0, weight: 0, sets: [{ reps: 8, weight: 0 }] }] },
    ];
    const csv = sessionsToCSV(sessions).split('\n');
    expect(csv[0]).toBe('date,workout,exercise,chain,rung,set,added_lb,reps,target,result,prescribed,deload');
    expect(csv).toHaveLength(4);
    expect(csv[1]).toBe('2026-09-01,Upper A,Pull-up,pull,4,1,0,5,5,hold,yes,yes');
    expect(csv[3]).toBe('2026-09-01,Upper A,Pull-up,pull,4,3,0,3,,hold,extra,yes');
  });
});
