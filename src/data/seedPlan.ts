import type { FixedWorkoutPlan, FlexWorkoutPlan, WorkoutTemplate, TemplateExercise } from '../types';

// ── Legacy PROGRAM 01 (v1 default) ─────────────────────────────────────────
// Kept so existing installs can be recognised as "untouched default" and for backup tests.
// It is no longer seeded on fresh installs.
export const PLAN_ID = 'plan_default';
export const TPL_A = 'tpl_strength_a';
export const TPL_B = 'tpl_strength_b';
export const TPL_AES = 'tpl_accessory';

type Slot = [exerciseId: string, sets: number, repMin: number, repMax: number, restSec: number, increment: number, startWeight: number, targetRir?: number, flags?: { superset?: boolean; lockVariation?: boolean }];

function slots(prefix: string, rows: Slot[]): TemplateExercise[] {
  return rows.map(([exerciseId, sets, repMin, repMax, restSec, increment, startWeight, targetRir, flags], i) => ({
    id: `${prefix}_${i}_${exerciseId}`,
    exerciseId,
    sets,
    repMin,
    repMax,
    restSec,
    increment,
    startWeight,
    ...(targetRir != null ? { targetRir } : {}),
    ...(flags?.superset ? { superset: true } : {}),
    ...(flags?.lockVariation ? { lockVariation: true } : {}),
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

/** True when a stored plan is byte-for-byte the v2 BOXER CUT seed (never edited by the user). */
export function isUntouchedBoxerCutSeed(plan: { id: string; name: string; mode?: string; weeklyGoals?: unknown } | null | undefined): boolean {
  if (!plan || plan.id !== BOXER_CUT_PLAN_ID || plan.mode !== 'flex') return false;
  return plan.name === BOXER_CUT_PLAN.name && JSON.stringify(plan.weeklyGoals) === JSON.stringify(BOXER_CUT_PLAN.weeklyGoals);
}

// ── CALISTHENICS CUT // FLEX (v3 default) ──────────────────────────────────
//
// Bodyweight only: a pull-up bar, the floor, a table, a couple of chairs. Four ~45-minute sessions a
// week in a fixed rotation UPPER A → LOWER A → UPPER B → LOWER B, so every muscle is hit twice a week
// with 10–16 hard sets. Progressive overload comes from the progression chains (data/exercises.ts):
// reach the rep ceiling on every prescribed set → the next session serves the next variation.
//
// Evidence the numbers lean on: hypertrophy is similar from ~6 to 30 reps when sets end near failure
// (Schoenfeld 2021; Lopez 2021), 10–20 weekly sets per muscle is the productive range for trained
// people (Schoenfeld 2017; Baz-Valle 2022), closer to failure grows more (Robinson 2024), and
// antagonist supersets cut session time by about a third with the same gains (Coleman 2024; Weakley 2025).
// Chains and graduation rules follow the r/bodyweightfitness Recommended Routine and Overcoming Gravity:
// pulls progress at 3×8, pushes at 3×12, legs at 3×10–12, holds at 3×30 s.

export const CALI_PLAN_ID = 'plan_calisthenics_cut_flex';
export const CALI_TPL_UA = 'tpl_cc_upper_a';
export const CALI_TPL_LA = 'tpl_cc_lower_a';
export const CALI_TPL_UB = 'tpl_cc_upper_b';
export const CALI_TPL_LB = 'tpl_cc_lower_b';
export const CALI_TPL_FLOW = 'tpl_cc_flow';
export const CALI_SEED_MARKER = 'calisthenics-cut-v1';
export const CALI_GOAL_DATE = '2027-03-31';

const UPPER_WARMUP = [
  'Wrist circles + shoulder circles · 60 s',
  'Bear crawl · 2 × 20 s forward/back',
  'Dead hang 20 s → scapular pull-ups × 8',
  'Incline or easy push-ups × 10, slow',
  'One easy set of the first pair at half effort',
];
const LOWER_WARMUP = [
  'Hip circles + ankle rocks · 60 s',
  'Deep squat hold · 30 s, shift side to side',
  'Frogger · 2 × 20 s',
  'Reverse lunges × 6 / side, glute bridges × 12',
  'Broad jumps × 5, land soft',
];

// exerciseId, sets, repMin, repMax, restSec, increment (added-load step, lb), startWeight, targetRir, flags
export const CALI_TEMPLATES: WorkoutTemplate[] = [
  {
    id: CALI_TPL_UA,
    name: 'UPPER A',
    subtitle: 'PULL-UP + PUSH-UP',
    warmup: UPPER_WARMUP,
    exercises: slots('cua', [
      ['pull-up', 3, 5, 8, 75, 5, 0, 2, { superset: true }], // PULL-UP CHAIN · advance at 3×8
      ['push-up', 3, 8, 12, 75, 5, 0, 2], // PUSH-UP CHAIN · advance at 3×12
      ['pike-push-up', 3, 6, 10, 60, 5, 0, 2, { superset: true }], // HANDSTAND CHAIN
      ['table-row', 3, 8, 12, 60, 5, 0, 1], // ROW CHAIN
      ['hanging-knee-raise', 3, 8, 12, 45, 2.5, 0, 1, { superset: true }], // HANGING CORE CHAIN
      ['prone-y-raise', 2, 12, 20, 45, 2.5, 0, 0], // rear delts · fixed · swap to band face pull once you have bands
    ]),
  },
  {
    id: CALI_TPL_LA,
    name: 'LOWER A',
    subtitle: 'SQUAT + NORDIC',
    warmup: LOWER_WARMUP,
    exercises: slots('cla', [
      ['bulgarian-split-squat-bw', 3, 6, 10, 75, 5, 0, 2, { superset: true }], // SQUAT CHAIN (per side)
      ['sliding-leg-curl', 3, 6, 10, 75, 5, 0, 2], // NORDIC CHAIN
      ['cossack-squat', 3, 8, 12, 60, 5, 0, 1, { superset: true }], // adductors · mobility · fixed
      ['single-leg-calf-raise', 3, 12, 20, 45, 5, 0, 0], // CALF CHAIN
      ['hollow-body-hold', 3, 15, 30, 45, 2.5, 0, 1, { superset: true }], // L-SIT CHAIN · seconds · advance at 3×30 s
      ['side-plank', 2, 20, 40, 30, 2.5, 0, 1], // SIDE CHAIN · seconds per side
    ]),
  },
  {
    id: CALI_TPL_UB,
    name: 'UPPER B',
    subtitle: 'CHIN-UP + DIP',
    warmup: UPPER_WARMUP,
    exercises: slots('cub', [
      ['chin-up', 3, 5, 8, 75, 5, 0, 2, { superset: true }], // CHIN-UP CHAIN
      ['chair-dip', 3, 8, 12, 75, 5, 0, 2], // DIP CHAIN
      ['table-row', 3, 8, 12, 60, 5, 0, 1, { superset: true }], // ROW CHAIN · second weekly exposure
      ['push-up', 3, 8, 12, 60, 5, 0, 1], // PUSH-UP CHAIN · second weekly exposure
      ['reverse-crunch', 3, 5, 8, 45, 2.5, 0, 1, { superset: true }], // DRAGON FLAG CHAIN
      ['wall-handstand-hold', 2, 20, 45, 45, 2.5, 0, 1], // shoulders · seconds · fixed
    ]),
  },
  {
    id: CALI_TPL_LB,
    name: 'LOWER B',
    subtitle: 'LUNGE + HIP THRUST',
    warmup: LOWER_WARMUP,
    exercises: slots('clb', [
      ['reverse-lunge', 3, 8, 12, 75, 5, 0, 2, { superset: true }], // LUNGE CHAIN (per side)
      ['single-leg-hip-thrust', 3, 10, 15, 75, 5, 0, 1], // HIP THRUST CHAIN (per side)
      ['sliding-leg-curl', 3, 6, 10, 60, 5, 0, 2, { superset: true }], // NORDIC CHAIN · second weekly exposure
      ['single-leg-calf-raise', 3, 12, 20, 45, 5, 0, 0], // CALF CHAIN
      ['hanging-knee-raise', 3, 8, 12, 45, 2.5, 0, 1, { superset: true }], // HANGING CORE CHAIN
      ['arch-raise', 2, 12, 15, 30, 2.5, 0, 1], // lower back · fixed
    ]),
  },
  {
    id: CALI_TPL_FLOW,
    name: 'FLOW',
    subtitle: 'LOCOMOTION + HANGS',
    warmup: ['Joint circles head to toe · 2 min', 'Easy cat-cow × 10, down-dog pedals × 10'],
    exercises: slots('ccf', [
      ['bear-crawl', 3, 30, 45, 30, 2.5, 0, 3], // seconds · GMB Elements
      ['monkey', 3, 30, 45, 30, 2.5, 0, 3],
      ['frogger', 3, 30, 45, 30, 2.5, 0, 3],
      ['deep-squat-hold', 3, 30, 60, 30, 2.5, 0, 3],
      ['dead-hang', 3, 20, 40, 45, 2.5, 0, 3],
      ['wall-handstand-hold', 3, 15, 30, 45, 2.5, 0, 2],
    ]),
  },
];

export const CALI_PLAN: FlexWorkoutPlan = {
  id: CALI_PLAN_ID,
  name: 'CALISTHENICS CUT',
  mode: 'flex',
  weeklyGoals: [
    // UPPER A → LOWER A → UPPER B → LOWER B. Alternating upper/lower means back-to-back days are fine (20 h gap).
    { id: 'goal_strength', kind: 'rotation', templateIds: [CALI_TPL_UA, CALI_TPL_LA, CALI_TPL_UB, CALI_TPL_LB], minimum: 3, target: 4, max: 5, minGapHours: 20 },
    // Low-fatigue movement practice. Never affects the week's verdict.
    { id: 'goal_flow', kind: 'workout', templateId: CALI_TPL_FLOW, minimum: 0, target: 1, max: 2, optional: true },
  ],
};

// Backwards-compatible aliases (fresh installs now seed CALISTHENICS CUT)
export const SEED_TEMPLATES = CALI_TEMPLATES;
export const SEED_PLAN = CALI_PLAN;
