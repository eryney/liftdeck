import type { WorkoutPlan, WorkoutTemplate, TemplateExercise } from '../types';

// Stable seed IDs so re-seeding is idempotent
export const PLAN_ID = 'plan_default';
export const TPL_A = 'tpl_strength_a';
export const TPL_B = 'tpl_strength_b';
export const TPL_AES = 'tpl_accessory';

type Slot = [exerciseId: string, sets: number, repMin: number, repMax: number, restSec: number, increment: number, startWeight: number];

function slots(prefix: string, rows: Slot[]): TemplateExercise[] {
  return rows.map(([exerciseId, sets, repMin, repMax, restSec, increment, startWeight], i) => ({
    id: `${prefix}_${i}_${exerciseId}`,
    exerciseId,
    sets,
    repMin,
    repMax,
    restSec,
    increment,
    startWeight,
  }));
}

export const SEED_TEMPLATES: WorkoutTemplate[] = [
  {
    id: TPL_A,
    name: 'STRENGTH A',
    exercises: slots('a', [
      ['db-bulgarian-split-squat', 3, 8, 12, 120, 5, 20],
      ['pull-up', 4, 5, 10, 120, 5, 0],
      ['db-incline-press', 3, 8, 15, 120, 5, 35],
      ['db-one-arm-row', 3, 8, 15, 90, 5, 40],
      ['db-lateral-raise', 4, 12, 25, 90, 2.5, 10],
      ['cable-curl', 3, 8, 15, 90, 2.5, 30],
      ['cable-triceps-pushdown', 3, 10, 20, 90, 2.5, 30],
    ]),
  },
  {
    id: TPL_B,
    name: 'STRENGTH B',
    exercises: slots('b', [
      ['db-rdl', 3, 8, 15, 120, 5, 40],
      ['chin-up', 4, 6, 12, 120, 5, 0],
      ['db-bench-press', 3, 8, 15, 120, 5, 40],
      ['db-hip-thrust', 3, 10, 20, 120, 5, 40],
      ['cable-rear-delt-fly', 3, 15, 25, 90, 2.5, 15],
      ['cable-lateral-raise', 3, 12, 25, 90, 2.5, 10],
      ['db-hammer-curl', 3, 10, 15, 90, 5, 20],
      ['cable-overhead-triceps', 3, 10, 15, 90, 2.5, 25],
    ]),
  },
  {
    id: TPL_AES,
    name: 'ACCESSORY',
    exercises: slots('x', [
      ['db-lateral-raise', 3, 12, 25, 90, 2.5, 10],
      ['db-rear-delt-fly', 3, 12, 25, 90, 2.5, 10],
      ['db-curl', 3, 10, 15, 90, 5, 20],
      ['cable-triceps-pushdown', 3, 10, 15, 90, 2.5, 30],
      ['standing-calf-raise', 3, 10, 20, 60, 5, 0],
      ['hanging-knee-raise', 3, 8, 15, 60, 5, 0],
    ]),
  },
];

export const SEED_PLAN: WorkoutPlan = {
  id: PLAN_ID,
  name: 'PROGRAM 01',
  schedule: [
    { type: 'boxing' }, // Mon
    { type: 'workout', templateId: TPL_A }, // Tue
    { type: 'boxing' }, // Wed
    { type: 'workout', templateId: TPL_B }, // Thu
    { type: 'workout', templateId: TPL_AES, optional: true }, // Fri
    { type: 'boxing' }, // Sat
    { type: 'boxing' }, // Sun
  ],
};
