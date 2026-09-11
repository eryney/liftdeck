import type { FixedWorkoutPlan, FlexWorkoutPlan, WorkoutTemplate, TemplateExercise } from '../types';

// ── Legacy PROGRAM 01 (v1 default) ─────────────────────────────────────────
// Kept so existing installs can be recognised as "untouched default" and for backup tests.
// It is no longer seeded on fresh installs.
export const PLAN_ID = 'plan_default';
export const TPL_A = 'tpl_strength_a';
export const TPL_B = 'tpl_strength_b';
export const TPL_AES = 'tpl_accessory';

type Slot = [exerciseId: string, sets: number, repMin: number, repMax: number, restSec: number, increment: number, startWeight: number, targetRir?: number];

function slots(prefix: string, rows: Slot[]): TemplateExercise[] {
  return rows.map(([exerciseId, sets, repMin, repMax, restSec, increment, startWeight, targetRir], i) => ({
    id: `${prefix}_${i}_${exerciseId}`,
    exerciseId,
    sets,
    repMin,
    repMax,
    restSec,
    increment,
    startWeight,
    ...(targetRir != null ? { targetRir } : {}),
  }));
}

export const LEGACY_SEED_TEMPLATES: WorkoutTemplate[] = [
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

export const LEGACY_SEED_PLAN: FixedWorkoutPlan = {
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

/** True when a stored plan is byte-for-byte the v1 default seed (never edited by the user). */
export function isUntouchedLegacySeed(plan: { id: string; name: string; mode?: string; schedule?: unknown } | null | undefined): boolean {
  if (!plan || plan.id !== PLAN_ID || plan.mode === 'flex') return false;
  return plan.name === LEGACY_SEED_PLAN.name && JSON.stringify(plan.schedule) === JSON.stringify(LEGACY_SEED_PLAN.schedule);
}

// ── BOXER CUT // FLEX (v2 default) ─────────────────────────────────────────

export const BOXER_CUT_PLAN_ID = 'plan_boxer_cut_flex';
export const BC_TPL_A = 'tpl_bc_strength_a';
export const BC_TPL_B = 'tpl_bc_strength_b';
export const BC_TPL_OPT = 'tpl_bc_optional_upper_abs';
export const BOXER_CUT_SEED_MARKER = 'boxer-cut-flex-v1';
export const BOXER_CUT_GOAL_DATE = '2026-12-31';

export const BOXER_CUT_TEMPLATES: WorkoutTemplate[] = [
  {
    id: BC_TPL_A,
    name: 'STRENGTH A',
    subtitle: 'FULL BODY',
    // exerciseId, sets, repMin, repMax, restSec, increment, startWeight, targetRir
    exercises: slots('bca', [
      ['db-bulgarian-split-squat', 2, 6, 10, 150, 5, 20, 2], // +5 lb per hand
      ['pull-up', 3, 5, 8, 150, 2.5, 0, 2], // weight = ADDED load; +2.5 lb total
      ['db-incline-press', 3, 6, 10, 150, 2.5, 35, 2], // +2.5 lb per hand
      ['db-rdl', 2, 6, 10, 150, 5, 40, 2], // +5 lb per hand
      ['cable-lateral-raise', 2, 12, 20, 60, 2.5, 10, 1],
      ['cable-crunch', 3, 8, 15, 75, 2.5, 30, 1],
    ]),
  },
  {
    id: BC_TPL_B,
    name: 'STRENGTH B',
    subtitle: 'FULL BODY',
    exercises: slots('bcb', [
      ['db-step-up', 2, 8, 12, 120, 5, 20, 2], // per leg; +5 lb per hand
      ['db-bench-press', 3, 6, 10, 150, 2.5, 40, 2], // +2.5 lb per hand
      ['db-one-arm-row', 3, 6, 10, 120, 5, 40, 2], // per side
      ['cable-leg-curl', 2, 10, 15, 90, 2.5, 20, 1],
      ['face-pull', 2, 12, 20, 60, 2.5, 30, 1],
      ['standing-calf-raise', 3, 10, 20, 60, 5, 0, 1], // added DB load allowed
      ['hanging-leg-raise', 3, 8, 15, 75, 2.5, 0, 1], // added load once 3×15 is easy
    ]),
  },
  {
    id: BC_TPL_OPT,
    name: 'OPTIONAL',
    subtitle: 'UPPER + ABS',
    exercises: slots('bco', [
      ['cable-lateral-raise', 3, 12, 20, 60, 2.5, 10, 1],
      ['cable-rear-delt-fly', 2, 12, 20, 60, 2.5, 15, 1],
      ['cable-curl', 2, 8, 15, 60, 2.5, 30, 1],
      ['cable-triceps-pushdown', 2, 8, 15, 60, 2.5, 30, 1],
      ['cable-woodchop', 2, 10, 15, 60, 2.5, 20, 2], // per side
      ['hanging-knee-raise', 2, 10, 15, 60, 2.5, 0, 1], // or cable crunch (suggested substitute)
    ]),
  },
];

export const BOXER_CUT_PLAN: FlexWorkoutPlan = {
  id: BOXER_CUT_PLAN_ID,
  name: 'BOXER CUT',
  mode: 'flex',
  weeklyGoals: [
    { id: 'goal_boxing', kind: 'boxing', minimum: 2, target: 4 },
    { id: 'goal_strength', kind: 'rotation', templateIds: [BC_TPL_A, BC_TPL_B], minimum: 1, target: 2, max: 2, minGapHours: 36 },
    { id: 'goal_optional', kind: 'workout', templateId: BC_TPL_OPT, minimum: 0, target: 1, max: 1, optional: true },
  ],
};

// Backwards-compatible aliases (fresh installs now seed BOXER CUT)
export const SEED_TEMPLATES = BOXER_CUT_TEMPLATES;
export const SEED_PLAN = BOXER_CUT_PLAN;
