export type Category =
  | 'Chest' | 'Back' | 'Shoulders' | 'Biceps' | 'Triceps'
  | 'Quads' | 'Hamstrings' | 'Glutes' | 'Calves' | 'Core'
  | 'Full Body' | 'Cardio' | 'Other';

export type Equipment = 'dumbbell' | 'barbell' | 'cable' | 'bodyweight' | 'machine' | 'other';

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
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  /** e.g. "FULL BODY", "UPPER + ABS" — shown after the name as NAME // SUBTITLE */
  subtitle?: string;
  exercises: TemplateExercise[];
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

export const SCHEMA_VERSION = 2;
export const PLAN_BUNDLE_VERSION = 2;
