import { useSyncExternalStore } from 'react';
import type {
  AppSettings, BodyMeasurement, Exercise,
  ExerciseSession, TemplateExercise, WorkoutPlan, WorkoutSession, WorkoutTemplate,
} from '../types';
import { bulkPut, clearAllStores, defaultSettings, del, loadAll, put } from '../lib/db';
import type { DBShape } from '../lib/db';
import { EXERCISE_LIBRARY, LIBRARY_IDS } from '../data/exercises';
import { LEGACY_PLAN_IDS, LEGACY_TEMPLATE_IDS, PLAN_ID, SEED_MARKER, SEED_PLAN, SEED_TEMPLATES } from '../data/seedPlan';
import { newId } from '../lib/ids';
import { todayISO } from '../lib/dates';
import { computeResult, lastPerformance, suggestWeight } from '../lib/progression';
import { adjacentVariation, resolveVariation } from '../lib/variation';
import { prescribeReps } from '../lib/prescribe';
import { migrateSettings, normalizePlans } from '../lib/migrate';
import type { BackupFile } from '../types';
import { SCHEMA_VERSION } from '../types';

export interface RestTimer {
  key: string; // changes on each restart so effects re-fire
  endsAt: number;
  totalSec: number;
}

export interface AppState {
  ready: boolean;
  settings: AppSettings;
  exercises: Exercise[];
  templates: WorkoutTemplate[];
  plans: WorkoutPlan[];
  sessions: WorkoutSession[];
  measurements: BodyMeasurement[];
  restTimer: RestTimer | null;
}

type Listener = () => void;

const persistErr = (e: unknown) => console.error('persist failed', e);

export class Store {
  state: AppState = {
    ready: false,
    settings: defaultSettings(),
    exercises: [],
    templates: [],
    plans: [],
    sessions: [],
    measurements: [],
    restTimer: null,
  };

  private listeners = new Set<Listener>();

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = (): AppState => this.state;

  private set(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn());
  }

  // ── boot ──────────────────────────────────────────────

  async init(): Promise<void> {
    let data = await loadAll();
    if (!data.settings) {
      await this.seed();
    } else {
      await this.migrateExisting(data);
    }
    data = await loadAll();
    this.hydrate(data);
  }

  private hydrate(data: DBShape): void {
    this.set({
      ready: true,
      settings: data.settings ?? defaultSettings(),
      exercises: data.exercises,
      templates: data.templates,
      plans: normalizePlans(data.plans),
      sessions: data.sessions.sort((a, b) => a.startedAt - b.startedAt),
      measurements: data.measurements,
    });
  }

  /** Fresh install: library + the bundled program as the active plan. */
  private async seed(): Promise<void> {
    await bulkPut('exercises', EXERCISE_LIBRARY);
    await bulkPut('templates', SEED_TEMPLATES);
    await put('plans', SEED_PLAN);
    await put('settings', { ...defaultSettings(), seedMarkers: [SEED_MARKER] } satisfies AppSettings);
  }

  /**
   * Existing install (any earlier version). History is never rewritten.
   * - settings gain current defaults (schemaVersion 4)
   * - the exercise library is resynced: library rows are refreshed (chain order, cues), custom rows are
   *   untouched, retired library rows (gym equipment, dropped rungs) are removed; sessions keep their names
   * - the bundled program is added once; legacy default plans/templates are removed and the program becomes
   *   active if the active plan was one of them (or missing)
   */
  private async migrateExisting(data: DBShape): Promise<void> {
    const settings = migrateSettings(data.settings);
    const markers = new Set(settings.seedMarkers ?? []);
    const before = JSON.stringify(data.settings);

    // library resync
    const haveEx = new Map(data.exercises.map((e) => [e.id, e]));
    const refreshed: Exercise[] = [];
    for (const lib of EXERCISE_LIBRARY) {
      const cur = haveEx.get(lib.id);
      if (!cur || JSON.stringify(cur) !== JSON.stringify(lib)) refreshed.push(lib);
    }
    if (refreshed.length > 0) await bulkPut('exercises', refreshed);
    for (const cur of data.exercises) {
      if (!cur.custom && !LIBRARY_IDS.has(cur.id)) await del('exercises', cur.id);
    }

    // plans: drop anything that is not a weekly-goal plan (fixed weekday plans from v1)
    const plans = normalizePlans(data.plans);
    for (const p of data.plans as Array<{ id: string }>) {
      if (!plans.some((q) => q.id === p.id)) await del('plans', p.id);
    }

    if (!markers.has(SEED_MARKER)) {
      const haveTpl = new Set(data.templates.map((t) => t.id));
      const newTpls = SEED_TEMPLATES.filter((t) => !haveTpl.has(t.id));
      if (newTpls.length > 0) await bulkPut('templates', newTpls);
      if (!plans.some((p) => p.id === PLAN_ID)) await put('plans', SEED_PLAN);

      const activeWasLegacy = settings.activePlanId == null || LEGACY_PLAN_IDS.includes(settings.activePlanId) || !plans.some((p) => p.id === settings.activePlanId);
      for (const id of LEGACY_PLAN_IDS) if (plans.some((p) => p.id === id) || (data.plans as Array<{ id: string }>).some((p) => p.id === id)) await del('plans', id);
      for (const id of LEGACY_TEMPLATE_IDS) if (haveTpl.has(id)) await del('templates', id);
      if (activeWasLegacy) settings.activePlanId = PLAN_ID;
      markers.add(SEED_MARKER);
      settings.seedMarkers = [...markers];
    } else if (settings.activePlanId == null || !plans.some((p) => p.id === settings.activePlanId)) {
      settings.activePlanId = plans.some((p) => p.id === PLAN_ID) ? PLAN_ID : plans[0]?.id ?? null;
    }
    if (JSON.stringify(settings) !== before) await put('settings', settings);
  }

  // ── settings / onboarding ─────────────────────────────

  updateSettings(patch: Partial<AppSettings>): void {
    const settings = { ...this.state.settings, ...patch };
    this.set({ settings });
    put('settings', settings).catch(persistErr);
  }

  completeOnboarding(planId: string | null): void {
    this.updateSettings({ onboarded: true, activePlanId: planId, startDate: todayISO() });
  }

  // ── derived ───────────────────────────────────────────

  activePlan(): WorkoutPlan | null {
    return this.state.plans.find((p) => p.id === this.state.settings.activePlanId) ?? null;
  }

  activeSession(): WorkoutSession | null {
    return this.state.sessions.find((s) => s.status === 'active') ?? null;
  }

  exerciseById(id: string): Exercise | undefined {
    return this.state.exercises.find((e) => e.id === id);
  }

  templateById(id: string): WorkoutTemplate | undefined {
    return this.state.templates.find((t) => t.id === id);
  }

  // ── workout sessions ──────────────────────────────────

  /**
   * Build the session snapshot for one template slot.
   * Chain exercises resolve to the rung the chain history says is right for today (see lib/variation.ts);
   * their added-load suggestion only steps up when the chain is at its top rung.
   */
  private buildExerciseSession(tpl: TemplateExercise): ExerciseSession {
    const sessions = this.state.sessions;
    const choice = resolveVariation(sessions, this.state.exercises, tpl);
    const exerciseId = choice?.exerciseId ?? tpl.exerciseId;
    const ex = this.exerciseById(exerciseId);
    let weight: number;
    if (!choice) {
      weight = suggestWeight(sessions, exerciseId, tpl).weight;
    } else if (choice.basis === 'top' || choice.basis === 'hold') {
      // same rung as last time: ordinary load logic applies (top of chain → +increment)
      weight = suggestWeight(sessions, exerciseId, { increment: tpl.increment, startWeight: 0 }).weight;
    } else {
      // moved to a different rung: pick up whatever load that rung was last done with, else bodyweight
      weight = lastPerformance(sessions, exerciseId)?.es.weight ?? 0;
    }
    const from = choice?.fromExerciseId ? this.exerciseById(choice.fromExerciseId) : undefined;
    const targetReps = this.targetsFor(exerciseId, tpl.sets, tpl.repMin, tpl.repMax, !!ex?.timed, weight);
    return {
      id: newId('es'),
      targetReps,
      exerciseId,
      name: ex?.name ?? exerciseId,
      perSide: ex?.perSide,
      bodyweight: true,
      targetSets: tpl.sets,
      repMin: tpl.repMin,
      repMax: tpl.repMax,
      restSec: tpl.restSec,
      increment: tpl.increment,
      suggestedWeight: weight,
      weight,
      sets: Array.from({ length: tpl.sets }, () => ({ reps: null, weight })),
      slotId: tpl.id,
      ...(ex?.timed ? { timed: true } : {}),
      ...(ex?.cue ? { cue: ex.cue } : {}),
      ...(ex?.gear ? { gear: ex.gear } : {}),
      ...(choice
        ? {
            progressionId: choice.progressionId,
            level: choice.level,
            levelCount: choice.levelCount,
            variationBasis: choice.basis,
            ...(choice.fromExerciseId ? { fromExerciseId: choice.fromExerciseId, fromName: from?.name ?? choice.fromExerciseId } : {}),
          }
        : {}),
    };
  }

  /**
   * Exact targets for a rung at a load: built from the last completed exposure of that rung AT THAT LOAD,
   * so a new rung (or a heavier backpack) starts at the floor of the range.
   */
  private targetsFor(exerciseId: string, sets: number, repMin: number, repMax: number, timed: boolean, weight: number): number[] {
    const last = lastPerformance(this.state.sessions, exerciseId);
    const sameLoad = last && last.es.weight === weight ? last.es : null;
    return prescribeReps({ sets, repMin, repMax, timed, last: sameLoad });
  }

  /** Every slot resolved to today's rung + targets, with antagonist pair groups assigned. */
  private buildSessionExercises(tpl: WorkoutTemplate): ExerciseSession[] {
    const exercises = tpl.exercises.map((te) => this.buildExerciseSession(te));
    // antagonist pairs: a slot flagged `superset` shares a group with the slot after it
    let group: string | null = null;
    tpl.exercises.forEach((te, i) => {
      if (group) exercises[i].pairGroup = group;
      if (te.superset && i < tpl.exercises.length - 1) {
        if (!group) {
          group = newId('pg');
          exercises[i].pairGroup = group;
        }
      } else {
        group = null;
      }
    });
    return exercises;
  }

  /** What a session of this template would look like right now (rungs, targets, pairs), without creating it. */
  previewWorkout(templateId: string): ExerciseSession[] {
    const tpl = this.templateById(templateId);
    return tpl ? this.buildSessionExercises(tpl) : [];
  }

  startWorkout(templateId: string, date = todayISO()): string {
    const tpl = this.templateById(templateId);
    if (!tpl) throw new Error('template not found');
    const exercises = this.buildSessionExercises(tpl);
    // strictly increasing start times: chain/progression lookups order exposures by startedAt
    const latest = this.state.sessions.reduce((m, x) => Math.max(m, x.startedAt), 0);
    const session: WorkoutSession = {
      id: newId('ws'),
      date,
      name: tpl.name,
      templateId,
      status: 'active',
      startedAt: Math.max(Date.now(), latest + 1),
      exercises,
      ...(tpl.warmup?.length ? { warmup: tpl.warmup } : {}),
    };
    this.set({ sessions: [...this.state.sessions, session] });
    put('sessions', session).catch(persistErr);
    return session.id;
  }

  private updateSession(id: string, fn: (s: WorkoutSession) => WorkoutSession): WorkoutSession | null {
    let updated: WorkoutSession | null = null;
    const sessions = this.state.sessions.map((s) => {
      if (s.id !== id) return s;
      updated = fn(s);
      return updated;
    });
    if (!updated) return null;
    this.set({ sessions });
    put('sessions', updated).catch(persistErr);
    return updated;
  }

  private updateExerciseSession(
    sessionId: string,
    esId: string,
    fn: (es: ExerciseSession) => ExerciseSession,
  ): void {
    this.updateSession(sessionId, (s) => ({
      ...s,
      exercises: s.exercises.map((es) => (es.id === esId ? fn(es) : es)),
    }));
  }

  /** Log reps for a set. Recomputes result if the session is already completed (history edit). */
  logSet(sessionId: string, esId: string, setIdx: number, reps: number | null): void {
    const all = this.state.sessions;
    this.updateSession(sessionId, (s) => {
      const exercises = s.exercises.map((es) => {
        if (es.id !== esId) return es;
        const sets = es.sets.map((set, i) =>
          i === setIdx ? { ...set, reps, weight: reps == null ? set.weight : es.weight, loggedAt: Date.now() } : set,
        );
        const next = { ...es, sets };
        if (s.status === 'completed') next.result = computeResult(next, all, s);
        return next;
      });
      return { ...s, exercises };
    });
  }

  /** Change added load; applies to unlogged sets. What was already lifted is never rewritten. */
  setExerciseWeight(sessionId: string, esId: string, weight: number): void {
    this.updateExerciseSession(sessionId, esId, (es) => {
      const next: ExerciseSession = {
        ...es,
        weight,
        targetReps: this.targetsFor(es.exerciseId, es.targetSets, es.repMin, es.repMax, !!es.timed, weight),
        sets: es.sets.map((set) => (set.reps == null ? { ...set, weight } : set)),
      };
      delete next.deload;
      return next;
    });
  }

  /**
   * Deload this exposure: every target drops to the floor of the range for this one session, and the
   * exposure is marked so it can never ADVANCE the chain and so stall detection restarts after it.
   * Turning it off restores the ordinary targets. Only meaningful before the first set.
   */
  setDeload(sessionId: string, esId: string, on: boolean): void {
    this.updateExerciseSession(sessionId, esId, (es) => {
      const next: ExerciseSession = { ...es };
      if (on) {
        next.deload = true;
        next.targetReps = Array.from({ length: es.targetSets }, () => es.repMin);
      } else {
        delete next.deload;
        next.targetReps = this.targetsFor(es.exerciseId, es.targetSets, es.repMin, es.repMax, !!es.timed, es.weight);
      }
      return next;
    });
  }

  addSet(sessionId: string, esId: string): void {
    this.updateExerciseSession(sessionId, esId, (es) => ({
      ...es,
      sets: [...es.sets, { reps: null, weight: es.weight }],
    }));
  }

  removeLastSet(sessionId: string, esId: string): void {
    this.updateExerciseSession(sessionId, esId, (es) =>
      es.sets.length > es.targetSets ? { ...es, sets: es.sets.slice(0, -1) } : es,
    );
  }

  /** Swap an exercise. Progression follows exercise identity: the substitute's own history drives its suggestion. */
  substituteExercise(sessionId: string, esId: string, newExerciseId: string, replaceInPlan: boolean): void {
    const ex = this.exerciseById(newExerciseId);
    if (!ex) return;
    const session = this.state.sessions.find((s) => s.id === sessionId);
    const old = session?.exercises.find((e) => e.id === esId);
    if (!session || !old) return;
    const tplLike = { increment: old.increment, startWeight: 0 };
    const { weight } = suggestWeight(this.state.sessions, newExerciseId, tplLike);
    const chain = ex.progressionId ? this.state.exercises.filter((e) => e.progressionId === ex.progressionId) : [];
    this.updateExerciseSession(sessionId, esId, (es) => {
      const next: ExerciseSession = {
        ...es,
        exerciseId: newExerciseId,
        name: ex.name,
        perSide: ex.perSide,
        bodyweight: true,
        substitutedFor: es.substitutedFor ?? es.name,
        suggestedWeight: weight,
        weight,
        sets: es.sets.map((set) => (set.reps == null ? { ...set, weight } : set)),
      };
      for (const k of ['timed', 'cue', 'gear', 'progressionId', 'level', 'levelCount', 'variationBasis', 'fromExerciseId', 'fromName', 'deload'] as const) delete next[k];
      next.targetReps = this.targetsFor(newExerciseId, es.targetSets, es.repMin, es.repMax, !!ex.timed, weight);
      if (ex.timed) next.timed = true;
      if (ex.cue) next.cue = ex.cue;
      if (ex.gear) next.gear = ex.gear;
      if (ex.progressionId) {
        next.progressionId = ex.progressionId;
        next.level = ex.level ?? 0;
        next.levelCount = chain.length;
        next.variationBasis = 'manual';
      }
      return next;
    });
    if (replaceInPlan && session.templateId) {
      const tpl = this.templateById(session.templateId);
      if (tpl) {
        let idx = old.slotId ? tpl.exercises.findIndex((te) => te.id === old.slotId) : -1;
        if (idx < 0) idx = tpl.exercises.findIndex((te) => te.exerciseId === old.exerciseId);
        if (idx >= 0) {
          const exercises = tpl.exercises.map((te, i) =>
            i === idx ? { ...te, exerciseId: newExerciseId } : te,
          );
          this.saveTemplate({ ...tpl, exercises });
        }
      }
    }
  }

  /**
   * Step one rung up or down the exercise's progression chain for THIS session. The new rung's own
   * history drives its targets; the chain picks up from whatever is actually performed.
   */
  shiftVariation(sessionId: string, esId: string, dir: -1 | 1): void {
    const session = this.state.sessions.find((s) => s.id === sessionId);
    const es = session?.exercises.find((e) => e.id === esId);
    if (!session || !es) return;
    const target = adjacentVariation(this.state.exercises, es.exerciseId, dir);
    if (!target) return;
    const weight = lastPerformance(this.state.sessions, target.id)?.es.weight ?? 0;
    const chainLen = this.state.exercises.filter((e) => e.progressionId === target.progressionId).length;
    this.updateExerciseSession(sessionId, esId, (cur) => {
      const next: ExerciseSession = {
        ...cur,
        exerciseId: target.id,
        name: target.name,
        perSide: target.perSide,
        bodyweight: true,
        suggestedWeight: weight,
        weight,
        sets: cur.sets.map((set) => (set.reps == null ? { ...set, weight } : set)),
        progressionId: target.progressionId,
        level: target.level ?? 0,
        levelCount: chainLen,
        variationBasis: 'manual',
        targetReps: this.targetsFor(target.id, cur.targetSets, cur.repMin, cur.repMax, !!target.timed, weight),
      };
      delete next.fromExerciseId;
      delete next.fromName;
      delete next.substitutedFor;
      delete next.deload;
      if (target.timed) next.timed = true; else delete next.timed;
      if (target.cue) next.cue = target.cue; else delete next.cue;
      if (target.gear) next.gear = target.gear; else delete next.gear;
      return next;
    });
  }

  finishWorkout(sessionId: string): WorkoutSession | null {
    const all = this.state.sessions;
    const finished = this.updateSession(sessionId, (s) => ({
      ...s,
      status: 'completed' as const,
      finishedAt: Date.now(),
      exercises: s.exercises.map((es) => ({ ...es, result: computeResult(es, all, s) })),
    }));
    this.clearRest();
    return finished;
  }

  abortWorkout(sessionId: string): void {
    this.set({ sessions: this.state.sessions.filter((s) => s.id !== sessionId) });
    del('sessions', sessionId).catch(persistErr);
    this.clearRest();
  }

  deleteSession(sessionId: string): void {
    this.set({ sessions: this.state.sessions.filter((s) => s.id !== sessionId) });
    del('sessions', sessionId).catch(persistErr);
  }

  // ── rest timer ────────────────────────────────────────

  startRest(totalSec: number): void {
    this.set({ restTimer: { key: newId('rt'), endsAt: Date.now() + totalSec * 1000, totalSec } });
  }

  extendRest(sec: number): void {
    const t = this.state.restTimer;
    if (!t) return;
    const base = Math.max(Date.now(), t.endsAt);
    this.set({ restTimer: { ...t, endsAt: base + sec * 1000, totalSec: t.totalSec + sec } });
  }

  clearRest(): void {
    if (this.state.restTimer) this.set({ restTimer: null });
  }

  // ── body measurements ─────────────────────────────────

  addMeasurement(date: string, weightLb: number, waistIn?: number): void {
    // one measurement per date: replace existing (keep an existing waist if the new entry omits it)
    const existing = this.state.measurements.find((m) => m.date === date);
    const rec: BodyMeasurement = {
      id: existing?.id ?? newId('bm'),
      date,
      weightLb,
      ...(waistIn != null ? { waistIn } : existing?.waistIn != null ? { waistIn: existing.waistIn } : {}),
      loggedAt: Date.now(),
    };
    this.set({
      measurements: [...this.state.measurements.filter((m) => m.date !== date), rec],
    });
    put('measurements', rec).catch(persistErr);
  }

  deleteMeasurement(id: string): void {
    this.set({ measurements: this.state.measurements.filter((m) => m.id !== id) });
    del('measurements', id).catch(persistErr);
  }

  // ── templates / plans ─────────────────────────────────

  saveTemplate(tpl: WorkoutTemplate): void {
    const exists = this.state.templates.some((t) => t.id === tpl.id);
    this.set({
      templates: exists
        ? this.state.templates.map((t) => (t.id === tpl.id ? tpl : t))
        : [...this.state.templates, tpl],
    });
    put('templates', tpl).catch(persistErr);
  }

  deleteTemplate(id: string): void {
    this.set({ templates: this.state.templates.filter((t) => t.id !== id) });
    for (const plan of this.state.plans) {
      const uses = plan.weeklyGoals.some(
        (g) => (g.kind === 'rotation' && g.templateIds.includes(id)) || (g.kind === 'workout' && g.templateId === id),
      );
      if (!uses) continue;
      this.savePlan({
        ...plan,
        weeklyGoals: plan.weeklyGoals
          .map((g) => (g.kind === 'rotation' ? { ...g, templateIds: g.templateIds.filter((t) => t !== id) } : g))
          .filter((g) => !(g.kind === 'workout' && g.templateId === id))
          .filter((g) => !(g.kind === 'rotation' && g.templateIds.length === 0)),
      });
    }
    del('templates', id).catch(persistErr);
  }

  savePlan(plan: WorkoutPlan): void {
    const exists = this.state.plans.some((p) => p.id === plan.id);
    this.set({
      plans: exists
        ? this.state.plans.map((p) => (p.id === plan.id ? plan : p))
        : [...this.state.plans, plan],
    });
    put('plans', plan).catch(persistErr);
  }

  deletePlan(id: string): void {
    this.set({ plans: this.state.plans.filter((p) => p.id !== id) });
    del('plans', id).catch(persistErr);
    if (this.state.settings.activePlanId === id) this.updateSettings({ activePlanId: null });
  }

  /** Put the bundled program back exactly as shipped (templates + weekly goals). History is untouched. */
  restoreDefaultProgram(): void {
    for (const t of SEED_TEMPLATES) this.saveTemplate(t);
    this.savePlan(SEED_PLAN);
    if (this.state.settings.activePlanId !== PLAN_ID) this.updateSettings({ activePlanId: PLAN_ID });
  }

  // ── exercise library ──────────────────────────────────

  saveExercise(ex: Exercise): void {
    const exists = this.state.exercises.some((e) => e.id === ex.id);
    this.set({
      exercises: exists
        ? this.state.exercises.map((e) => (e.id === ex.id ? ex : e))
        : [...this.state.exercises, ex],
    });
    put('exercises', ex).catch(persistErr);
  }

  deleteExercise(id: string): void {
    const ex = this.exerciseById(id);
    if (!ex?.custom) return; // only custom exercises are deletable
    this.set({ exercises: this.state.exercises.filter((e) => e.id !== id) });
    del('exercises', id).catch(persistErr);
  }

  // ── backup / reset ────────────────────────────────────

  exportShape(): DBShape {
    const s = this.state;
    return {
      settings: s.settings,
      exercises: s.exercises,
      templates: s.templates,
      plans: s.plans,
      sessions: s.sessions,
      measurements: s.measurements,
    };
  }

  /** FULL restore: replaces the entire database with the backup (already migrated by parseBackup). */
  async importBackup(backup: BackupFile): Promise<void> {
    await clearAllStores();
    await bulkPut('exercises', backup.exercises);
    await bulkPut('templates', backup.templates);
    await bulkPut('plans', backup.plans);
    await bulkPut('sessions', backup.sessions);
    await bulkPut('measurements', backup.measurements);
    await put('settings', { ...backup.settings, id: 'settings', schemaVersion: SCHEMA_VERSION });
    // a restored older backup gets the same one-time additions an upgraded install gets
    await this.migrateExisting(await loadAll());
    this.hydrate(await loadAll());
  }

  /** Wipe everything and reseed the default plan; returns to onboarding. */
  async resetAll(): Promise<void> {
    await clearAllStores();
    await this.seed();
    this.set({ restTimer: null });
    this.hydrate(await loadAll());
  }
}

export const store = new Store();

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
