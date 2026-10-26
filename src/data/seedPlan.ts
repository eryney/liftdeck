import type { TemplateExercise, WorkoutPlan, WorkoutTemplate } from '../types';

// ── BAR STRENGTH · the default program ──────────────────────────────────────────────────────────
//
// Bodyweight only: a pull-up bar, the floor, a wall, a sturdy table, a couple of chairs. Four ~45-minute
// sessions a week in a fixed rotation UPPER A → LOWER A → UPPER B → LOWER B, so every muscle is trained
// twice a week with 12–18 hard sets. Progressive overload comes from the progression chains
// (data/exercises.ts): reach the rep ceiling on every prescribed set → the next session serves the next
// variation. At the top of a chain, add load with a backpack.
//
// Evidence the numbers lean on:
//   · strength is best served by hard sets of ~5–8 on the primary movements, hypertrophy is similar from
//     ~6 to 30 reps when sets end near failure (Schoenfeld 2017, 2021; Lopez 2021), so primaries run 5–8
//     and secondaries 6–12
//   · 10–20 weekly hard sets per muscle is the productive range for trained people (Schoenfeld 2017;
//     Baz-Valle 2022), hit twice a week (Schoenfeld 2016)
//   · closer to failure grows more (Refalo 2023; Robinson 2024): every set has an exact target one rep
//     above last time
//   · 2–3 min rest beats 1 min for strength and size (Schoenfeld 2016); antagonist supersets give each
//     muscle ~3 min while the session stays short (Weakley 2017; Coleman 2024)
//   · isometric holds build strength near the trained position (Lum & Barbosa 2019); the front lever and
//     planche progressions are the straight-arm strength work that bars make possible (Low, Overcoming Gravity)
//   · stalls are handled by a short deload (reset targets to the floor) or a volume block one rung down
//     rather than by grinding (Low; Coleman 2024 deload trial)
// Chain order and graduation rules follow the r/bodyweightfitness Recommended Routine and Overcoming Gravity.

export const PLAN_ID = 'plan_bar_strength';
export const TPL_UA = 'tpl_bs_upper_a';
export const TPL_LA = 'tpl_bs_lower_a';
export const TPL_UB = 'tpl_bs_upper_b';
export const TPL_LB = 'tpl_bs_lower_b';
export const TPL_FLOW = 'tpl_bs_flow';
export const SEED_MARKER = 'bar-strength-v4';

/** Ids of the plan and templates from the previous default (CALISTHENICS CUT, v3), replaced on upgrade. */
export const LEGACY_PLAN_IDS = ['plan_calisthenics_cut_flex', 'plan_boxer_cut_flex', 'plan_default'];
export const LEGACY_TEMPLATE_IDS = [
  'tpl_cc_upper_a', 'tpl_cc_lower_a', 'tpl_cc_upper_b', 'tpl_cc_lower_b', 'tpl_cc_flow',
  'tpl_bc_strength_a', 'tpl_bc_strength_b', 'tpl_bc_optional_upper_abs',
  'tpl_strength_a', 'tpl_strength_b', 'tpl_accessory',
];

type Slot = [exerciseId: string, sets: number, repMin: number, repMax: number, restSec: number, flags?: { superset?: boolean; lockVariation?: boolean }];

function slots(prefix: string, rows: Slot[]): TemplateExercise[] {
  return rows.map(([exerciseId, sets, repMin, repMax, restSec, flags], i) => ({
    id: `${prefix}_${i}_${exerciseId}`,
    exerciseId,
    sets,
    repMin,
    repMax,
    restSec,
    increment: 5,
    startWeight: 0,
    ...(flags?.superset ? { superset: true } : {}),
    ...(flags?.lockVariation ? { lockVariation: true } : {}),
  }));
}

const UPPER_WARMUP = [
  'Wrist circles, shoulder circles · 60 s',
  'Bear crawl · 2 × 20 s forward and back',
  'Dead hang 20 s, then scapular pull-ups × 8',
  'Easy push-ups × 10, slow',
  'One easy set of the first pair at half effort',
];
const LOWER_WARMUP = [
  'Hip circles, ankle rocks · 60 s',
  'Deep squat hold · 30 s, shift side to side',
  'Frogger · 2 × 20 s',
  'Reverse lunges × 6 per side, glute bridges × 12',
  'Broad jumps × 5, land soft',
];

// exerciseId, sets, repMin, repMax, restSec, flags
export const SEED_TEMPLATES: WorkoutTemplate[] = [
  {
    id: TPL_UA,
    name: 'Upper A',
    subtitle: 'Pull-up + push-up',
    warmup: UPPER_WARMUP,
    exercises: slots('ua', [
      ['pull-up', 3, 5, 8, 90, { superset: true }], // PULL-UP CHAIN · advance at 3×8
      ['push-up', 3, 5, 8, 90], // PUSH-UP CHAIN
      ['pike-push-up', 3, 5, 8, 75, { superset: true }], // HANDSTAND CHAIN
      ['table-row', 3, 6, 10, 75], // ROW CHAIN
      ['tuck-front-lever', 3, 10, 20, 60, { superset: true }], // FRONT LEVER CHAIN · seconds · advance at 3×20 s
      ['planche-lean', 3, 10, 20, 60], // PLANCHE CHAIN · seconds
      ['hanging-knee-raise', 3, 8, 12, 45], // HANGING CORE CHAIN
    ]),
  },
  {
    id: TPL_LA,
    name: 'Lower A',
    subtitle: 'Squat + Nordic',
    warmup: LOWER_WARMUP,
    exercises: slots('la', [
      ['bulgarian-split-squat-bw', 4, 5, 8, 90, { superset: true }], // SQUAT CHAIN · per side
      ['sliding-leg-curl', 4, 5, 8, 90], // NORDIC CHAIN
      ['cossack-squat', 3, 8, 12, 60, { superset: true }], // adductors · mobility · fixed
      ['single-leg-calf-raise', 3, 12, 20, 60], // CALF CHAIN
      ['hollow-body-hold', 3, 15, 30, 45, { superset: true }], // L-SIT CHAIN · seconds · advance at 3×30 s
      ['side-plank', 2, 20, 40, 45], // SIDE CHAIN · seconds per side
    ]),
  },
  {
    id: TPL_UB,
    name: 'Upper B',
    subtitle: 'Chin-up + dip',
    warmup: UPPER_WARMUP,
    exercises: slots('ub', [
      ['chin-up', 3, 6, 10, 90, { superset: true }], // CHIN-UP CHAIN
      ['chair-dip', 3, 6, 10, 90], // DIP CHAIN
      ['table-row', 3, 6, 10, 75, { superset: true }], // ROW CHAIN · second weekly exposure
      ['push-up', 3, 5, 8, 75], // PUSH-UP CHAIN · second weekly exposure
      ['reverse-crunch', 3, 5, 8, 60, { superset: true }], // DRAGON FLAG CHAIN
      ['wall-handstand-hold', 3, 20, 45, 60], // shoulders · seconds · fixed
      ['prone-y-raise', 2, 12, 20, 45], // rear delts · fixed · swap to band face pull once you have bands
    ]),
  },
  {
    id: TPL_LB,
    name: 'Lower B',
    subtitle: 'Lunge + hip thrust',
    warmup: LOWER_WARMUP,
    exercises: slots('lb', [
      ['reverse-lunge', 4, 8, 12, 90, { superset: true }], // LUNGE CHAIN · per side
      ['single-leg-hip-thrust', 4, 10, 15, 90], // HIP THRUST CHAIN · per side
      ['sliding-leg-curl', 3, 5, 8, 60, { superset: true }], // NORDIC CHAIN · second weekly exposure
      ['single-leg-calf-raise', 3, 12, 20, 60], // CALF CHAIN
      ['hanging-knee-raise', 3, 8, 12, 45, { superset: true }], // HANGING CORE CHAIN
      ['arch-raise', 2, 12, 15, 45], // lower back · fixed
    ]),
  },
  {
    id: TPL_FLOW,
    name: 'Flow',
    subtitle: 'Locomotion + hangs · optional',
    warmup: ['Joint circles head to toe · 2 min', 'Easy cat-cow × 10, down-dog pedals × 10'],
    exercises: slots('fl', [
      ['bear-crawl', 3, 30, 45, 30], // seconds · GMB Elements
      ['monkey', 3, 30, 45, 30],
      ['frogger', 3, 30, 45, 30],
      ['deep-squat-hold', 3, 30, 60, 30],
      ['dead-hang', 3, 20, 40, 45],
      ['wall-handstand-hold', 3, 15, 30, 45],
    ]),
  },
];

export const SEED_PLAN: WorkoutPlan = {
  id: PLAN_ID,
  name: 'Bar Strength',
  mode: 'flex',
  weeklyGoals: [
    // UPPER A → LOWER A → UPPER B → LOWER B. Alternating upper/lower means back-to-back days are fine (20 h gap).
    { id: 'goal_strength', kind: 'rotation', templateIds: [TPL_UA, TPL_LA, TPL_UB, TPL_LB], minimum: 3, target: 4, max: 5, minGapHours: 20 },
    // Low-fatigue movement practice. Never affects the week's verdict.
    { id: 'goal_flow', kind: 'workout', templateId: TPL_FLOW, minimum: 0, target: 1, max: 2, optional: true },
  ],
};
