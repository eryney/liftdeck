import type { TemplateExercise, WorkoutPlan, WorkoutTemplate } from '../types';
import { EXERCISE_LIBRARY } from './exercises';

export const FULL_BODY_MARKER = 'full-body-three-days-v1';
export const TPL_FA = 'tpl_full_body_a';
export const TPL_FB = 'tpl_full_body_b';
export const TPL_ACCESSORY = 'tpl_accessories';
export const TPL_CARDIO = 'tpl_cardio';
export const SPLIT_TEMPLATE_IDS = ['tpl_bs_upper_a', 'tpl_bs_lower_a', 'tpl_bs_upper_b', 'tpl_bs_lower_b', 'tpl_bs_flow'];

type Slot = [string, number, number, number, number, boolean?];
function slots(prefix: string, rows: Slot[]): TemplateExercise[] {
  return rows.map(([exerciseId, sets, repMin, repMax, restSec, superset], i) => {
    const ex = EXERCISE_LIBRARY.find((e) => e.id === exerciseId)!;
    return { id: `${prefix}_${i}_${exerciseId}`, exerciseId, sets, repMin, repMax, restSec,
      startWeight: 0, increment: ex.bandResistance || ex.repsOnly ? 0 : 5,
      ...(superset ? { superset: true } : {}),
    };
  });
}

const warmup = [
  'Shoulder circles, wrist circles, hip circles · 60 s',
  'Light band pull-aparts × 10',
  'Bodyweight squats × 10, easy hip hinges × 10',
  'Dead bug × 5 per side',
  'One easy set of each strength movement before its work sets',
];

/** RR-inspired movement coverage, adapted to bands and upright bar work. */
export const FULL_BODY_TEMPLATES: WorkoutTemplate[] = [
  { id: TPL_FA, name: 'Full Body A', subtitle: 'Pull-up + squat · press + hinge · row + push-up', warmup,
    exercises: slots('fa', [
      ['pull-up', 3, 5, 8, 90, true],
      ['bulgarian-split-squat-bw', 3, 5, 8, 90],
      ['band-shoulder-press', 3, 8, 15, 90, true],
      ['band-romanian-deadlift', 3, 8, 15, 90],
      ['band-bent-over-row', 3, 8, 15, 90, true],
      ['push-up', 3, 5, 8, 90],
      ['dead-bug', 2, 8, 12, 60, true],
      ['side-plank', 2, 20, 40, 60, true],
      ['arch-raise', 2, 12, 15, 60],
    ]) },
  { id: TPL_FB, name: 'Full Body B', subtitle: 'Chin-up + lunge · dip + curl · row + push-up', warmup,
    exercises: slots('fb', [
      ['chin-up', 3, 5, 8, 90, true],
      ['reverse-lunge', 3, 8, 12, 90],
      ['chair-dip', 3, 5, 8, 90, true],
      ['sliding-leg-curl', 3, 5, 8, 90],
      ['band-bent-over-row', 3, 8, 15, 90, true],
      ['push-up', 3, 5, 8, 90],
      ['floor-reverse-crunch', 2, 8, 12, 60, true],
      ['side-plank', 2, 20, 40, 60, true],
      ['arch-raise', 2, 12, 15, 60],
    ]) },
  { id: TPL_ACCESSORY, name: 'Accessories', activityType: 'accessory', subtitle: 'Optional · arms, shoulders, glutes, calves',
    warmup: ['Easy joint circles · 2 min', 'Use a light band for your first set'],
    exercises: slots('ac', [
      ['band-curl', 2, 10, 15, 60, true],
      ['band-overhead-triceps-extension', 2, 10, 15, 60],
      ['band-lateral-raise', 2, 12, 20, 60, true],
      ['band-pull-apart', 2, 12, 20, 60],
      ['single-leg-glute-bridge', 2, 10, 15, 60, true],
      ['single-leg-calf-raise', 2, 12, 20, 60],
    ]) },
  { id: TPL_CARDIO, name: 'Cardio', subtitle: 'Optional · log a walk, run, ride, or other cardio', activityType: 'cardio', exercises: [] },
];

export const FULL_BODY_PLAN: WorkoutPlan = {
  id: 'plan_bar_strength', name: 'Full Body · 3 days', mode: 'flex',
  weeklyGoals: [
    { id: 'goal_strength', kind: 'rotation', templateIds: [TPL_FA, TPL_FB], minimum: 3, target: 3, max: 3, minGapHours: 24, restDays: 1 },
    { id: 'goal_optional', kind: 'workout', templateId: TPL_ACCESSORY, alternativeTemplateIds: [TPL_CARDIO], minimum: 0, target: 2, max: 2, optional: true },
  ],
};

/** Keep calibrated starting variations from the old split while adopting the new set counts. */
export function fullBodyTemplatesFor(existing: WorkoutTemplate[]): WorkoutTemplate[] {
  const oldSlots = existing.filter((t) => SPLIT_TEMPLATE_IDS.includes(t.id)).flatMap((t) => t.exercises);
  return FULL_BODY_TEMPLATES.map((template) => ({ ...template, exercises: template.exercises.map((slot) => {
    const chain = EXERCISE_LIBRARY.find((e) => e.id === slot.exerciseId)?.progressionId;
    if (!chain) return slot;
    const previous = oldSlots.find((s) => EXERCISE_LIBRARY.find((e) => e.id === s.exerciseId)?.progressionId === chain);
    return previous ? { ...slot, exerciseId: previous.exerciseId, ...(previous.lockVariation ? { lockVariation: true } : {}) } : slot;
  }) }));
}
