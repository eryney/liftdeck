import { describe, expect, it } from 'vitest';
import { buildBackup, measurementsToCSV, parseBackup, sessionsToCSV } from '../src/lib/backup';
import { defaultSettings } from '../src/lib/db';
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

describe('backup roundtrip', () => {
  it('export → parse reconstructs the data', () => {
    const backup = buildBackup(shape);
    const parsed = parseBackup(JSON.stringify(backup));
    expect(parsed.measurements).toEqual(shape.measurements);
    expect(parsed.settings.units).toBe('lb');
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

describe('csv', () => {
  it('renders measurements', () => {
    const csv = measurementsToCSV(shape.measurements);
    expect(csv).toBe('date,weight_lb,waist_in\n2026-08-01,180.5,');
  });

  it('renders only logged sets of completed sessions', () => {
    const sessions: WorkoutSession[] = [
      {
        id: 'w1',
        date: '2026-08-02',
        name: 'STRENGTH A',
        status: 'completed',
        startedAt: 1,
        exercises: [
          {
            id: 'e1',
            exerciseId: 'x',
            name: 'Incline, "DB" Press',
            targetSets: 2,
            repMin: 8,
            repMax: 15,
            restSec: 120,
            increment: 5,
            suggestedWeight: 45,
            weight: 45,
            result: 'progress',
            sets: [
              { reps: 15, weight: 45 },
              { reps: null, weight: 45 },
            ],
          },
        ],
      },
    ];
    const csv = sessionsToCSV(sessions);
    const lines = csv.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('2026-08-02,STRENGTH A,"Incline, ""DB"" Press",1,45,15,progress');
  });
});
