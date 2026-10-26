export type Category =
  | 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps'
  | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Core'
  | 'Full Body' | 'Cardio' | 'Other';

/** Everything is bodyweight. `band` marks the few exercises that need a resistance band. */
export type Equipment = 'bodyweight' | 'band' | 'other';

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  equipment: Equipment;
  /** performed one side/leg/arm at a time: a set is left + right */
  perSide?: boolean;
  /** always true in the current library; kept so older records read the same */
  bodyweight?: boolean;
  custom?: boolean;
  /**
   * Progression chain this variation belongs to (see data/progressions.ts) and its position in it.
   * Chains are how bodyweight exercises overload: hit the rep ceiling → move to the next variation.
   */
  progressionId?: string;
  level?: number;
  /** sets are measured in seconds held rather than reps */
  timed?: boolean;
  /** household gear needed, e.g. "pull-up bar", "two chairs", "band" */
  gear?: string;
  /** one-line form cue shown during the session */
  cue?: string;
}

/** One slot in a workout template */
export interface TemplateExercise {
  id: string; // stable slot id
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  /** added-load step (backpack) once the chain is at its top rung */
  increment: number;
  /** starting added load before any history exists (almost always 0) */
  startWeight: number;
  /** antagonist pairing: alternate sets with the NEXT slot (A1 → B1 → A2 → B2 …) */
  superset?: boolean;
  /** stay on exactly this variation; never follow the progression chain */
  lockVariation?: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  /** e.g. "Pull-up + push-up" — shown under the name */
  subtitle?: string;
  exercises: TemplateExercise[];
  /** short warm-up checklist shown before the first set */
  warmup?: string[];
}

export type WeeklyGoal =
  | {
      id: string;
      kind: 'rotation';
      /** templates cycled chronologically: A → B → A → B, never reset by the calendar */
      templateIds: string[];
      minimum: number;
      target: number;
      max?: number;
      /** suggested spacing between sessions of this rotation */
      minGapHours?: number;
    }
  | {
      id: string;
      kind: 'workout';
      templateId: string;
      minimum: number;
      target: number;
      max?: number;
      /** optional goals never affect the week's verdict */
      optional?: boolean;
    };

/** Weekly-goal plan: attainment is judged per week (Mon–Sun), never per weekday. */
export interface WorkoutPlan {
  id: string;
  name: string;
  mode: 'flex';
  weeklyGoals: WeeklyGoal[];
}

export interface SetRecord {
  reps: number | null; // null = not yet performed
  weight: number; // lb; added weight on top of bodyweight
  loggedAt?: number;
}

/**
 * Outcome of an exercise exposure.
 * v1 snapshots used 'progress' | 'keep'; later versions use increase | hold | reduce | incomplete.
 * Old values are kept verbatim in history and mapped for display.
 */
export type ExerciseResult = 'progress' | 'keep' | 'increase' | 'hold' | 'reduce' | 'incomplete';

/**
 * Why a session landed on a particular variation of a chain exercise.
 *   start     no chain history yet → the template's variation
 *   advance   last exposure hit the rep ceiling → next variation
 *   hold      last exposure was fine but not at the ceiling → same variation, chase reps
 *   regress   two consecutive below-range exposures → previous variation (a suggestion)
 *   top       ceiling hit on the last variation of the chain → same variation, add load / tempo
 *   manual    the user stepped up/down or substituted inside the chain
 */
export type VariationBasis = 'start' | 'advance' | 'hold' | 'regress' | 'top' | 'manual';

/** Snapshot of an exercise as performed in a session — independent of templates */
export interface ExerciseSession {
  id: string;
  exerciseId: string;
  name: string;
  perSide?: boolean;
  bodyweight?: boolean;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  increment: number;
  /** what the app recommended at session start */
  suggestedWeight: number;
  /** added load actually in use (user can override) */
  weight: number;
  sets: SetRecord[];
  substitutedFor?: string; // name of the originally planned exercise
  result?: ExerciseResult; // computed when session completes
  /** template slot this exercise was built from (so "replace in plan" survives chain resolution) */
  slotId?: string;
  /** progression chain snapshot (absent for exercises that are not in a chain, or locked slots) */
  progressionId?: string;
  level?: number;
  levelCount?: number;
  variationBasis?: VariationBasis;
  /** the variation performed last time in this chain, when different from today's */
  fromExerciseId?: string;
  fromName?: string;
  timed?: boolean;
  cue?: string;
  gear?: string;
  /** exercises sharing a pairGroup alternate sets (antagonist superset) */
  pairGroup?: string;
  /** exact rep (or seconds) target per prescribed set, computed at session start (see lib/prescribe.ts) */
  targetReps?: number[];
  /** this exposure was a deliberate deload (targets reset to the floor); stall detection restarts after it */
  deload?: boolean;
  /** legacy telemetry from older versions; never shown or used */
  finalSetRir?: number;
  targetRir?: number;
}

export interface WorkoutSession {
  id: string;
  date: string; // YYYY-MM-DD local
  name: string;
  templateId?: string;
  status: 'active' | 'completed';
  startedAt: number;
  finishedAt?: number;
  exercises: ExerciseSession[];
  warmup?: string[];
}

export interface BodyMeasurement {
  id: string;
  date: string; // YYYY-MM-DD
  weightLb: number;
  waistIn?: number;
  loggedAt: number;
}

export interface AppSettings {
  id: 'settings';
  schemaVersion: number;
  onboarded: boolean;
  activePlanId: string | null;
  /** adherence is not counted before this date */
  startDate: string;
  units: 'lb' | 'kg';
  maWindowDays: number;
  soundOn: boolean;
  vibrateOn: boolean;
  /** one-time seed/migration markers so bundled plans are added exactly once */
  seedMarkers?: string[];
}

export interface BackupFile {
  app: 'liftdeck';
  schemaVersion: number;
  exportedAt: string;
  settings: AppSettings;
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  measurements: BodyMeasurement[];
}

export const SCHEMA_VERSION = 4;
