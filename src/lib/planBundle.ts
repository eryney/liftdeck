import type { Exercise, FixedWorkoutPlan, FlexWorkoutPlan, PlanBundle, WeeklyGoal, WorkoutPlan, WorkoutTemplate } from '../types';
import { PLAN_BUNDLE_VERSION } from '../types';
import { EXERCISE_LIBRARY, V1_LIBRARY_IDS } from '../data/exercises';
import { isFlexPlan } from './flex';

/**
 * Portable plan bundles: { app: 'liftdeck-plan', schemaVersion, plan, templates, exercises }.
 * Export includes the plan, every template it references, and only the exercise definitions
 * that are not part of the built-in library (custom ones, or library additions like cable-leg-curl
 * that an older app might not have). Import NEVER touches history, boxing, measurements, or settings.
 */

const LIBRARY_IDS = new Set(EXERCISE_LIBRARY.map((e) => e.id));

export function planTemplateIds(plan: WorkoutPlan): string[] {
  const ids: string[] = [];
  if (isFlexPlan(plan)) {
    for (const g of plan.weeklyGoals) {
      if (g.kind === 'rotation') ids.push(...g.templateIds);
      if (g.kind === 'workout') ids.push(g.templateId);
    }
  } else {
    for (const d of plan.schedule) if (d.type === 'workout') ids.push(d.templateId);
  }
  return [...new Set(ids)];
}

export function buildPlanBundle(plan: WorkoutPlan, templates: WorkoutTemplate[], exercises: Exercise[]): PlanBundle {
  const tplIds = planTemplateIds(plan);
  const tpls = tplIds.map((id) => templates.find((t) => t.id === id)).filter((t): t is WorkoutTemplate => !!t);
  const exIds = new Set(tpls.flatMap((t) => t.exercises.map((te) => te.exerciseId)));
  const exs = exercises.filter((e) => exIds.has(e.id) && (e.custom || !LIBRARY_IDS.has(e.id)));
  // Library exercises not yet shipped in older builds are included too so the bundle is self-contained.
  for (const id of exIds) {
    if (!exs.some((e) => e.id === id)) {
      const lib = EXERCISE_LIBRARY.find((e) => e.id === id);
      if (lib && !LEGACY_LIBRARY_IDS.has(id)) exs.push(lib);
    }
  }
  return { app: 'liftdeck-plan', schemaVersion: PLAN_BUNDLE_VERSION, exportedAt: new Date().toISOString(), plan, templates: tpls, exercises: exs };
}

/** Exercises that existed in the v1 library. Anything newer travels inside the bundle so older apps can import it. */
const LEGACY_LIBRARY_IDS = V1_LIBRARY_IDS;

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

function isNum(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

function validateGoal(g: unknown, i: number): WeeklyGoal {
  if (!isObj(g)) throw new Error(`Weekly goal #${i + 1} is not an object.`);
  if (typeof g.id !== 'string' || !g.id) throw new Error(`Weekly goal #${i + 1} is missing an id.`);
  if (!isNum(g.minimum) || !isNum(g.target)) throw new Error(`Weekly goal "${g.id}" needs numeric minimum and target.`);
  if (g.max != null && !isNum(g.max)) throw new Error(`Weekly goal "${g.id}" has a non-numeric max.`);
  if (g.kind === 'boxing') return g as unknown as WeeklyGoal;
  if (g.kind === 'rotation') {
    if (!Array.isArray(g.templateIds) || g.templateIds.length === 0 || !g.templateIds.every((t) => typeof t === 'string')) {
      throw new Error(`Rotation goal "${g.id}" needs a non-empty templateIds array.`);
    }
    return g as unknown as WeeklyGoal;
  }
  if (g.kind === 'workout') {
    if (typeof g.templateId !== 'string') throw new Error(`Workout goal "${g.id}" is missing templateId.`);
    return g as unknown as WeeklyGoal;
  }
  throw new Error(`Weekly goal "${g.id}" has unknown kind "${String(g.kind)}".`);
}

function validateTemplate(t: unknown, i: number): WorkoutTemplate {
  if (!isObj(t)) throw new Error(`Template #${i + 1} is not an object.`);
  if (typeof t.id !== 'string' || !t.id) throw new Error(`Template #${i + 1} is missing an id.`);
  if (typeof t.name !== 'string' || !t.name) throw new Error(`Template "${t.id}" is missing a name.`);
  if (!Array.isArray(t.exercises)) throw new Error(`Template "${t.name}" is missing its exercises array.`);
  t.exercises.forEach((te, j) => {
    if (!isObj(te)) throw new Error(`Template "${t.name}" exercise #${j + 1} is not an object.`);
    if (typeof te.id !== 'string' || typeof te.exerciseId !== 'string') throw new Error(`Template "${t.name}" exercise #${j + 1} needs id and exerciseId.`);
    for (const k of ['sets', 'repMin', 'repMax', 'restSec', 'increment', 'startWeight'] as const) {
      if (!isNum(te[k])) throw new Error(`Template "${t.name}" · "${te.exerciseId}" has a non-numeric ${k}.`);
    }
    if (te.targetRir != null && !isNum(te.targetRir)) throw new Error(`Template "${t.name}" · "${te.exerciseId}" has a non-numeric targetRir.`);
    for (const k of ['superset', 'lockVariation'] as const) {
      if (te[k] != null && typeof te[k] !== 'boolean') throw new Error(`Template "${t.name}" · "${te.exerciseId}" has a non-boolean ${k}.`);
    }
  });
  if (t.warmup != null && (!Array.isArray(t.warmup) || !t.warmup.every((w) => typeof w === 'string'))) {
    throw new Error(`Template "${t.name}" has a malformed warmup list.`);
  }
  return t as unknown as WorkoutTemplate;
}

function validateExercise(e: unknown, i: number): Exercise {
  if (!isObj(e)) throw new Error(`Exercise #${i + 1} is not an object.`);
  if (typeof e.id !== 'string' || !e.id) throw new Error(`Exercise #${i + 1} is missing an id.`);
  if (typeof e.name !== 'string' || !e.name) throw new Error(`Exercise "${e.id}" is missing a name.`);
  if (typeof e.category !== 'string' || typeof e.equipment !== 'string') throw new Error(`Exercise "${e.id}" needs category and equipment.`);
  if (e.progressionId != null && typeof e.progressionId !== 'string') throw new Error(`Exercise "${e.id}" has a non-string progressionId.`);
  if (e.level != null && !isNum(e.level)) throw new Error(`Exercise "${e.id}" has a non-numeric level.`);
  return e as unknown as Exercise;
}

/**
 * Parse + validate a bundle. `knownExerciseIds` are exercises already present on the device;
 * every exercise a template references must be in the bundle or already known.
 */
export function parsePlanBundle(text: string, knownExerciseIds: Iterable<string> = LIBRARY_IDS): PlanBundle {
  let obj: unknown;
  try {
    obj = JSON.parse(text);
  } catch {
    throw new Error('File is not valid JSON.');
  }
  if (!isObj(obj)) throw new Error('File is not a plan bundle.');
  if (obj.app === 'liftdeck') throw new Error('This is a full backup, not a plan. Use IMPORT BACKUP for it.');
  if (obj.app !== 'liftdeck-plan') throw new Error('This file is not a LIFTDECK plan bundle.');
  if (!isNum(obj.schemaVersion) || obj.schemaVersion > PLAN_BUNDLE_VERSION) throw new Error('Plan bundle was made by a newer app version.');
  if (!isObj(obj.plan)) throw new Error('Plan bundle is missing "plan".');
  if (!Array.isArray(obj.templates)) throw new Error('Plan bundle is missing "templates".');
  const exercisesRaw = Array.isArray(obj.exercises) ? obj.exercises : [];

  const p = obj.plan;
  if (typeof p.id !== 'string' || !p.id) throw new Error('Plan is missing an id.');
  if (typeof p.name !== 'string' || !p.name) throw new Error('Plan is missing a name.');
  let plan: WorkoutPlan;
  if (p.mode === 'flex') {
    if (!Array.isArray(p.weeklyGoals)) throw new Error(`Flex plan "${p.name}" is missing weeklyGoals.`);
    plan = { id: p.id, name: p.name, mode: 'flex', weeklyGoals: p.weeklyGoals.map(validateGoal) };
  } else if (p.mode === 'fixed' || p.mode == null) {
    if (!Array.isArray(p.schedule) || p.schedule.length !== 7) throw new Error(`Fixed plan "${p.name}" needs a 7-day schedule.`);
    for (const d of p.schedule) {
      if (!isObj(d) || !['rest', 'boxing', 'workout'].includes(String(d.type))) throw new Error(`Fixed plan "${p.name}" has an invalid schedule entry.`);
      if (d.type === 'workout' && typeof d.templateId !== 'string') throw new Error(`Fixed plan "${p.name}" has a workout day without templateId.`);
    }
    plan = { id: p.id, name: p.name, ...(p.mode ? { mode: 'fixed' as const } : {}), schedule: p.schedule as FixedWorkoutPlan['schedule'] };
  } else {
    throw new Error(`Plan mode "${String(p.mode)}" is not supported.`);
  }

  const templates = obj.templates.map(validateTemplate);
  const exercises = exercisesRaw.map(validateExercise);

  // reference checks
  const tplIds = new Set(templates.map((t) => t.id));
  for (const id of planTemplateIds(plan)) {
    if (!tplIds.has(id)) throw new Error(`Plan "${plan.name}" references template "${id}", which is not in the bundle.`);
  }
  const known = new Set<string>([...knownExerciseIds, ...exercises.map((e) => e.id)]);
  for (const t of templates) {
    for (const te of t.exercises) {
      if (!known.has(te.exerciseId)) {
        throw new Error(`Template "${t.name}" references unknown exercise "${te.exerciseId}". Add it to the bundle's "exercises".`);
      }
    }
  }
  return { app: 'liftdeck-plan', schemaVersion: obj.schemaVersion, exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : undefined, plan, templates, exercises };
}

export interface ResolvedBundle {
  plan: WorkoutPlan;
  /** templates to add (new ids only; identical existing templates are reused) */
  templates: WorkoutTemplate[];
  /** exercise definitions to add (never overwrites an existing one) */
  exercises: Exercise[];
  notes: string[];
}

function sameTemplate(a: WorkoutTemplate, b: WorkoutTemplate): boolean {
  return a.name === b.name && JSON.stringify(a.exercises) === JSON.stringify(b.exercises);
}

function freeId(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; i < 1000; i++) {
    const id = `${base}_${i}`;
    if (!taken.has(id)) return id;
  }
  return `${base}_${Date.now().toString(36)}`;
}

/**
 * Resolve ID collisions against what is already on the device:
 * - exercise id exists → keep the existing definition (history refers to it); if names differ, the bundle's
 *   exercise gets a fresh id and templates are remapped.
 * - template id exists and is identical → reuse; otherwise fresh id + remap plan references.
 * - plan id exists → fresh id (a re-import never overwrites your edited plan).
 */
export function resolveBundle(
  bundle: PlanBundle,
  existing: { plans: WorkoutPlan[]; templates: WorkoutTemplate[]; exercises: Exercise[] },
): ResolvedBundle {
  const notes: string[] = [];
  const exMap = new Map<string, string>();
  const newExercises: Exercise[] = [];
  const takenEx = new Set(existing.exercises.map((e) => e.id));
  for (const e of bundle.exercises) {
    const cur = existing.exercises.find((x) => x.id === e.id);
    if (!cur) {
      takenEx.add(e.id);
      newExercises.push(e);
    } else if (cur.name.trim().toLowerCase() === e.name.trim().toLowerCase()) {
      // same exercise already present: reuse it
    } else {
      const id = freeId(e.id, takenEx);
      takenEx.add(id);
      exMap.set(e.id, id);
      newExercises.push({ ...e, id, custom: true });
      notes.push(`Exercise "${e.name}" imported as "${id}" (id "${e.id}" already means "${cur.name}").`);
    }
  }

  const tplMap = new Map<string, string>();
  const newTemplates: WorkoutTemplate[] = [];
  const takenTpl = new Set(existing.templates.map((t) => t.id));
  for (const t of bundle.templates) {
    const remapped: WorkoutTemplate = {
      ...t,
      exercises: t.exercises.map((te) => ({ ...te, exerciseId: exMap.get(te.exerciseId) ?? te.exerciseId })),
    };
    const cur = existing.templates.find((x) => x.id === t.id);
    if (!cur) {
      takenTpl.add(t.id);
      newTemplates.push(remapped);
    } else if (sameTemplate(cur, remapped)) {
      notes.push(`Template "${t.name}" already exists and is identical; reused.`);
    } else {
      const id = freeId(t.id, takenTpl);
      takenTpl.add(id);
      tplMap.set(t.id, id);
      newTemplates.push({ ...remapped, id });
      notes.push(`Template "${t.name}" imported as a new copy (an edited "${cur.name}" already uses id "${t.id}").`);
    }
  }

  let plan: WorkoutPlan;
  if (isFlexPlan(bundle.plan)) {
    const fp: FlexWorkoutPlan = {
      ...bundle.plan,
      weeklyGoals: bundle.plan.weeklyGoals.map((g) => {
        if (g.kind === 'rotation') return { ...g, templateIds: g.templateIds.map((id) => tplMap.get(id) ?? id) };
        if (g.kind === 'workout') return { ...g, templateId: tplMap.get(g.templateId) ?? g.templateId };
        return g;
      }),
    };
    plan = fp;
  } else {
    plan = {
      ...bundle.plan,
      schedule: bundle.plan.schedule.map((d) => (d.type === 'workout' ? { ...d, templateId: tplMap.get(d.templateId) ?? d.templateId } : d)),
    };
  }
  const takenPlans = new Set(existing.plans.map((p) => p.id));
  if (takenPlans.has(plan.id)) {
    const id = freeId(plan.id, takenPlans);
    notes.push(`A plan with id "${plan.id}" already exists; imported as "${id}".`);
    plan = { ...plan, id };
  }
  return { plan, templates: newTemplates, exercises: newExercises, notes };
}
