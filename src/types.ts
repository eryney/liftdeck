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
  increment: number;
  /** starting weight before any history exists */
  startWeight: number;
}

export interface WorkoutTemplate {
  id: string;
  name: string;
  exercises: TemplateExercise[];
}

export type DayActivity =
  | { type: 'rest' }
  | { type: 'boxing'; optional?: boolean }
  | { type: 'workout'; templateId: string; optional?: boolean };

export interface WorkoutPlan {
  id: string;
  name: string;
  /** index 0 = Monday ... 6 = Sunday */
  schedule: DayActivity[];
}

export interface SetRecord {
  reps: number | null; // null = not yet performed
  weight: number; // lb; for bodyweight exercises: added weight
  loggedAt?: number;
}

export type ExerciseResult = 'progress' | 'keep';

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
  /** what the app recommended at session start */
  suggestedWeight: number;
  /** working weight actually in use (user can override) */
  weight: number;
  sets: SetRecord[];
  substitutedFor?: string; // name of the originally planned exercise
  result?: ExerciseResult; // computed when session completes
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

export interface BoxingAttendance {
  id: string;
  date: string; // YYYY-MM-DD
  loggedAt: number;
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

export const SCHEMA_VERSION = 1;
