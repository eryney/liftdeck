export type Category =
  | 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps'
  | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Core'
  | 'Full Body' | 'Cardio' | 'Other';

export type Equipment = 'dumbbell' | 'barbell' | 'cable' | 'bodyweight' | 'band' | 'machine' | 'other';

export interface Exercise {
  id: string;
  name: string;
  category: Category;
  equipment: Equipment;
  /** weight is per dumbbell/hand */
  perHand?: boolean;
  /** performed one side/leg at a time */
  perSide?: boolean;
  /** bodyweight exercise: "weight" means added weight */
  bodyweight?: boolean;
  compound?: boolean;
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
  /** load increment for this slot (per hand for perHand exercises; total added load for bodyweight) */
  increment: number;
  /** starting weight before any history exists */
  startWeight: number;
  /** reps in reserve to aim for on working sets (optional telemetry; never drives progression) */
  targetRir?: number;
  /** antagonist pairing: alternate sets with the NEXT slot (A1 → B1 → A2 → B2 …) */
  superset?: boolean;
  /** stay on exactly this variation; never follow the progression chain */
  lockVariation?: boolean;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  /** e.g. "FULL BODY", "UPPER + ABS" — shown after the name as NAME // SUBTITLE */
  subtitle?: string;
  exercises: TemplateExercise[];
  /** short warm-up checklist shown before the first set */
  warmup?: string[];
}

export type DayActivity =
  | { type: 'rest' }
  | { type: 'boxing'; optional?: boolean }
  | { type: 'workout'; templateId: string; optional?: boolean };

/** Legacy weekday-based plan. Records without `mode` are treated as fixed. */
export interface FixedWorkoutPlan {
  id: string;
  name: string;
  mode?: 'fixed';
  /** index 0 = Monday ... 6 = Sunday */
  schedule: DayActivity[];
}

export type WeeklyGoal =
  | {
      id: string;
      kind: 'boxing';
      minimum: number;
      target: number;
      max?: number;
    }
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
      /** optional goals never affect foundation/target attainment */
      optional?: boolean;
    };

/** Weekly-goal plan: attainment is judged per week (Mon–Sun), never per weekday. */
export interface FlexWorkoutPlan {
  id: string;
  name: string;
  mode: 'flex';
  weeklyGoals: WeeklyGoal[];
}

export type WorkoutPlan = FixedWorkoutPlan | FlexWorkoutPlan;

export interface SetRecord {
  reps: number | null; // null = not yet performed
  weight: number; // lb; for bodyweight exercises: added weight
  loggedAt?: number;
}

/**
 * Outcome of an exercise exposure.
 * v1 snapshots used 'progress' | 'keep'; v2 uses increase | hold | reduce | incomplete.
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
  perHand?: boolean;
  perSide?: boolean;
  bodyweight?: boolean;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSec: number;
  increment: number;
  targetRir?: number;
  /** what the app recommended at session start */
  suggestedWeight: number;
  /** working weight actually in use (user can override) */
  weight: number;
  sets: SetRecord[];
  substitutedFor?: string; // name of the originally planned exercise
  result?: ExerciseResult; // computed when session completes
  /** optional one-tap RIR after the final prescribed set */
  finalSetRir?: number;
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

export type BoxingSessionType = 'technical' | 'bag' | 'sparring' | 'conditioning' | 'mixed';

export interface BoxingAttendance {
  id: string;
  date: string; // YYYY-MM-DD
  loggedAt: number;
  /** all optional: attendance itself is the record */
  durationMin?: number;
  rpe?: number;
  sessionType?: BoxingSessionType;
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
  defaultIncrement: number;
  compoundRestSec: number;
  isolationRestSec: number;
  maWindowDays: number;
  soundOn: boolean;
  vibrateOn: boolean;
  /** prompt for reps-in-reserve after the final set (off by default: fewer taps) */
  askRir?: boolean;
  /** body-composition goal metadata (no targets are invented by the app) */
  goalMode?: 'cut' | null;
  goalDate?: string;
  goalWeightLb?: number;
  goalWaistIn?: number;
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
  boxing: BoxingAttendance[];
  measurements: BodyMeasurement[];
}

/** Portable plan bundle: plan + its templates + any non-library exercises it needs. Never carries history. */
export interface PlanBundle {
  app: 'liftdeck-plan';
  schemaVersion: number;
  exportedAt?: string;
  plan: WorkoutPlan;
  templates: WorkoutTemplate[];
  exercises: Exercise[];
}

export const SCHEMA_VERSION = 3;
export const PLAN_BUNDLE_VERSION = 3;
