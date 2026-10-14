import { describe, expect, it } from 'vitest';
import { buildBackup, measurementsToCSV, parseBackup, sessionsToCSV } from '../src/lib/backup';
import { defaultSettings } from '../src/lib/db';
import { migrateBackup, migrateSettings } from '../src/lib/migrate';
import { LEGACY_SEED_PLAN, LEGACY_SEED_TEMPLATES } from '../src/data/seedPlan';
import { SCHEMA_VERSION } from '../src/types';
import type { WorkoutSession } from '../src/types';

const shape = {
  settings: defaultSettings(),
  exercises: [],
  templates: [],
  plans: [],
  sessions: [] as WorkoutSession[],
  boxing: [],
  measurements: [{ id: 'm1', date: '2026-08-01', weightLb: 180.5, loggedAt: 1 }],
};

/** A realistic v1 backup exactly as the 1.0 app wrote it. */
export function v1Backup() {
  const session: WorkoutSession = {
    id: 'ws_old',
    date: '2026-08-25',
    name: 'STRENGTH A',
    templateId: 'tpl_strength_a',
    status: 'completed',
    startedAt: 1756150000000,
    finishedAt: 1756153000000,
    exercises: [
      {
        id: 'es_old', exerciseId: 'db-incline-press', name: 'Dumbbell Incline Bench Press', perHand: true, targetSets: 3, repMin: 8, repMax: 15,
        restSec: 120, increment: 5, suggestedWeight: 45, weight: 45, result: 'progress',
        sets: [{ reps: 15, weight: 45, loggedAt: 1 }, { reps: 15, weight: 45, loggedAt: 2 }, { reps: 15, weight: 45, loggedAt: 3 }],
      },
    ],
  };
  return {
    app: 'liftdeck',
    schemaVersion: 1,
    exportedAt: '2026-08-30T10:00:00.000Z',
    settings: {
      id: 'settings', schemaVersion: 1, onboarded: true, activePlanId: 'plan_default', startDate: '2026-08-10', units: 'lb',
      defaultIncrement: 5, compoundRestSec: 120, isolationRestSec: 90, maWindowDays: 7, soundOn: true, vibrateOn: true,
    },
    exercises: [],
    templates: LEGACY_SEED_TEMPLATES,
    plans: [LEGACY_SEED_PLAN],
    sessions: [session],
    boxing: [{ id: 'bx_old', date: '2026-08-24', loggedAt: 1756060000000 }],
    measurements: [{ id: 'bm_old', date: '2026-08-24', weightLb: 184.2, waistIn: 35.5, loggedAt: 1756060000000 }],
  };
}

describe('backup roundtrip', () => {
  it('export → parse reconstructs the data at the current schema version', () => {
    const backup = buildBackup(shape);
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.measurements).toEqual(shape.measurements);
    expect(parsed.settings.units).toBe('lb');
  });

  it('preserves v2 fields (boxing metadata, RIR, targetRir, flex plans, goals)', () => {
    const backup = buildBackup({
      ...shape,
      settings: { ...defaultSettings(), goalMode: 'cut', goalDate: '2026-12-31' },
      boxing: [{ id: 'b', date: '2026-09-01', loggedAt: 1, durationMin: 60, rpe: 8, sessionType: 'sparring' }],
      plans: [{ id: 'p', name: 'F', mode: 'flex', weeklyGoals: [{ id: 'g', kind: 'boxing', minimum: 2, target: 4 }] }],
      sessions: [{ id: 's', date: '2026-09-01', name: 'A', status: 'completed', startedAt: 1, exercises: [{ id: 'e', exerciseId: 'x', name: 'X', targetSets: 1, repMin: 5, repMax: 8, restSec: 60, increment: 2.5, targetRir: 2, suggestedWeight: 0, weight: 0, sets: [{ reps: 8, weight: 0 }], finalSetRir: 1, result: 'increase' }] }],
    });
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.boxing[0]).toMatchObject({ durationMin: 60, rpe: 8, sessionType: 'sparring' });
    expect(parsed.sessions[0].exercises[0]).toMatchObject({ targetRir: 2, finalSetRir: 1, result: 'increase' });
    expect(parsed.plans[0]).toMatchObject({ mode: 'flex' });
    expect(parsed.settings).toMatchObject({ goalMode: 'cut', goalDate: '2026-12-31' });
  });

  it('rejects non-liftdeck files', () => {
    expect(() => parseBackup('{"app":"other"}')).toThrow();
    expect(() => parseBackup('not json')).toThrow();
  });

  it('rejects newer schema versions', () => {
    const backup = { ...buildBackup(shape), schemaVersion: 999 };
    expect(() => parseBackup(JSON.stringify(backup))).toThrow(/newer/);
  });
});

describe('legacy v1 data', () => {
  it('a v1 backup still imports and is migrated to v2', () => {
    const parsed = parseBackup(JSON.stringify(v1Backup()));
    expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.settings.schemaVersion).toBe(SCHEMA_VERSION);
    expect(parsed.settings.activePlanId).toBe('plan_default');
    expect(parsed.settings.seedMarkers).toEqual([]);
  });

  it('history, boxing and measurements are byte-identical after migration', () => {
    const raw = v1Backup();
    const parsed = parseBackup(JSON.stringify(raw));
    expect(parsed.sessions).toEqual(raw.sessions);
    expect(parsed.boxing).toEqual(raw.boxing);
    expect(parsed.measurements).toEqual(raw.measurements);
    expect(parsed.sessions[0].exercises[0].result).toBe('progress'); // v1 value preserved verbatim
  });

  it('plans without mode remain fixed plans and are untouched', () => {
    const parsed = parseBackup(JSON.stringify(v1Backup()));
    expect(parsed.plans[0]).toEqual(LEGACY_SEED_PLAN);
    expect((parsed.plans[0] as any).mode).toBeUndefined();
  });

  it('migrateBackup is a no-op on current-version files; migrateSettings fills defaults without overriding values', () => {
    const b = buildBackup(shape);
    expect(migrateBackup(b)).toBe(b);
    const s = migrateSettings({ id: 'settings', schemaVersion: 1, onboarded: true, activePlanId: 'x', startDate: '2026-01-01', units: 'lb', defaultIncrement: 5, compoundRestSec: 100, isolationRestSec: 50, maWindowDays: 5, soundOn: false, vibrateOn: false });
    expect(s).toMatchObject({ schemaVersion: SCHEMA_VERSION, activePlanId: 'x', compoundRestSec: 100, soundOn: false, seedMarkers: [], goalMode: null });
  });
});

describe('csv', () => {
  it('renders measurements', () => {
    const csv = measurementsToCSV(shape.measurements);
    expect(csv).toBe('date,weight_lb,waist_in\n2026-08-01,180.5,');
  });

  it('renders only logged sets of completed sessions, flags extra sets and final-set RIR', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 'w1',
        date: '2026-08-02',
        name: 'STRENGTH A',
        status: 'completed',
        startedAt: 1,
        exercises: [
          {
            id: 'e1', exerciseId: 'x', name: 'Incline, "DB" Press', targetSets: 2, repMin: 8, repMax: 15, restSec: 120, increment: 5,
            suggestedWeight: 45, weight: 45, result: 'increase', finalSetRir: 1,
            sets: [{ reps: 15, weight: 45 }, { reps: 15, weight: 45 }, { reps: 9, weight: 45 }, { reps: null, weight: 45 }],
          },
        ],
      },
    ];
    const lines = sessionsToCSV(sessions).split('\n');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toBe('2026-08-02,STRENGTH A,"Incline, ""DB"" Press",1,45,15,,increase,yes,');
    expect(lines[2]).toBe('2026-08-02,STRENGTH A,"Incline, ""DB"" Press",2,45,15,,increase,yes,1');
    expect(lines[3]).toBe('2026-08-02,STRENGTH A,"Incline, ""DB"" Press",3,45,9,,increase,extra,');
  });
});
