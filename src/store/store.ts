import { useSyncExternalStore } from 'react';
import type {
  AppSettings, BodyMeasurement, BoxingAttendance, DayActivity, Exercise,
  ExerciseSession, TemplateExercise, WorkoutPlan, WorkoutSession, WorkoutTemplate,
} from '../types';
import { bulkPut, clearAllStores, defaultSettings, del, loadAll, put } from '../lib/db';
import type { DBShape } from '../lib/db';
import { EXERCISE_LIBRARY } from '../data/exercises';
import {
  BOXER_CUT_GOAL_DATE, BOXER_CUT_PLAN, BOXER_CUT_PLAN_ID, BOXER_CUT_SEED_MARKER, BOXER_CUT_TEMPLATES, isUntouchedLegacySeed,
  CALI_GOAL_DATE, CALI_PLAN, CALI_PLAN_ID, CALI_SEED_MARKER, CALI_TEMPLATES, isUntouchedBoxerCutSeed,
} from '../data/seedPlan';
import { newId } from '../lib/ids';
import { todayISO, weekdayIndex } from '../lib/dates';
import { computeResult, lastPerformance, suggestWeight } from '../lib/progression';
import { adjacentVariation, resolveVariation } from '../lib/variation';
import { prescribeReps } from '../lib/prescribe';
import { isFixedPlan, isFlexPlan } from '../lib/flex';
import { migrateSettings } from '../lib/migrate';
import type { ResolvedBundle } from '../lib/planBundle';
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
  boxing: BoxingAttendance[];
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
    boxing: [],
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
      plans: data.plans,
      sessions: data.sessions.sort((a, b) => a.startedAt - b.startedAt),
      boxing: data.boxing,
      measurements: data.measurements,
    });
  }

  /** Fresh install: library + CALISTHENICS CUT // FLEX as the default plan. */
  private async seed(): Promise<void> {
    await bulkPut('exercises', EXERCISE_LIBRARY);
    await bulkPut('templates', CALI_TEMPLATES);
    await put('plans', CALI_PLAN);
    await put('settings', {
      ...defaultSettings(),
      goalMode: 'cut',
      goalDate: CALI_GOAL_DATE,
      // both markers: a fresh install never gets the older BOXER CUT seed added later
      seedMarkers: [BOXER_CUT_SEED_MARKER, CALI_SEED_MARKER],
    } satisfies AppSettings);
  }

  /**
   * Existing install. Nothing is deleted or rewritten:
   * - settings gain current defaults (schemaVersion 3)
   * - library exercises missing from the device are added; existing ones are untouched EXCEPT that
   *   v1 bodyweight exercises gain their progression-chain tags (progressionId/level/cue) if they lack them
   * - BOXER CUT // FLEX (v2) and CALISTHENICS CUT // FLEX (v3) templates + plan are added exactly once each
   * - the newest bundled plan becomes active only if the active plan is still an untouched default seed
   */
  private async migrateExisting(data: DBShape): Promise<void> {
    const settings = migrateSettings(data.settings);
    const markers = new Set(settings.seedMarkers ?? []);
    const before = JSON.stringify(data.settings);

    const haveEx = new Map(data.exercises.map((e) => [e.id, e]));
    const missingEx = EXERCISE_LIBRARY.filter((e) => !haveEx.has(e.id));
    if (missingEx.length > 0) await bulkPut('exercises', missingEx);
    // chain tags on pre-existing library rows (never touches custom exercises or user edits to name/category)
    const retagged: Exercise[] = [];
    for (const lib of EXERCISE_LIBRARY) {
      const cur = haveEx.get(lib.id);
      if (!cur || cur.custom || !lib.progressionId || cur.progressionId) continue;
      retagged.push({ ...cur, progressionId: lib.progressionId, level: lib.level, bodyweight: true, ...(lib.cue ? { cue: lib.cue } : {}), ...(lib.gear ? { gear: lib.gear } : {}), ...(lib.timed ? { timed: true } : {}) });
    }
    if (retagged.length > 0) await bulkPut('exercises', retagged);

    if (!markers.has(BOXER_CUT_SEED_MARKER)) {
      const haveTpl = new Set(data.templates.map((t) => t.id));
      const newTpls = BOXER_CUT_TEMPLATES.filter((t) => !haveTpl.has(t.id));
      if (newTpls.length > 0) await bulkPut('templates', newTpls);
      if (!data.plans.some((p) => p.id === BOXER_CUT_PLAN_ID)) await put('plans', BOXER_CUT_PLAN);
      markers.add(BOXER_CUT_SEED_MARKER);
      settings.seedMarkers = [...markers];

      const active = data.plans.find((p) => p.id === settings.activePlanId) ?? null;
      const shouldActivate = settings.activePlanId == null ? !settings.onboarded : isUntouchedLegacySeed(active);
      if (shouldActivate) {
        settings.activePlanId = BOXER_CUT_PLAN_ID;
        if (settings.goalMode == null) {
          settings.goalMode = 'cut';
          settings.goalDate = settings.goalDate ?? BOXER_CUT_GOAL_DATE;
        }
      }
    }

    if (!markers.has(CALI_SEED_MARKER)) {
      const haveTpl = new Set(data.templates.map((t) => t.id));
      const newTpls = CALI_TEMPLATES.filter((t) => !haveTpl.has(t.id));
      if (newTpls.length > 0) await bulkPut('templates', newTpls);
      if (!data.plans.some((p) => p.id === CALI_PLAN_ID)) await put('plans', CALI_PLAN);
      markers.add(CALI_SEED_MARKER);
      settings.seedMarkers = [...markers];

      // the plan that is active right now, including one the BOXER CUT block just activated above
      const activeId = settings.activePlanId;
      const active = data.plans.find((p) => p.id === activeId) ?? (activeId === BOXER_CUT_PLAN_ID ? BOXER_CUT_PLAN : null);
      const shouldActivate = activeId == null ? !settings.onboarded : isUntouchedBoxerCutSeed(active) || isUntouchedLegacySeed(active);
      if (shouldActivate) {
        settings.activePlanId = CALI_PLAN_ID;
        if (settings.goalMode == null) settings.goalMode = 'cut';
        if (settings.goalDate == null || settings.goalDate === BOXER_CUT_GOAL_DATE) settings.goalDate = CALI_GOAL_DATE;
      }
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

  /** Fixed plans only; flex plans have no weekday activities. */
  activityFor(date: string): DayActivity {
    const plan = this.activePlan();
    return plan && isFixedPlan(plan) ? plan.schedule[weekdayIndex(date)] : { type: 'rest' };
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
      perHand: ex?.perHand,
      perSide: ex?.perSide,
      bodyweight: ex?.bodyweight,
      targetSets: tpl.sets,
      repMin: tpl.repMin,
      repMax: tpl.repMax,
      restSec: tpl.restSec,
      increment: tpl.increment,
      ...(tpl.targetRir != null ? { targetRir: tpl.targetRir } : {}),
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

  /** Change working weight; applies to unlogged sets. What was already lifted is never rewritten. */
  setExerciseWeight(sessionId: string, esId: string, weight: number): void {
    this.updateExerciseSession(sessionId, esId, (es) => ({
      ...es,
      weight,
      targetReps: this.targetsFor(es.exerciseId, es.targetSets, es.repMin, es.repMax, !!es.timed, weight),
      sets: es.sets.map((set) => (set.reps == null ? { ...set, weight } : set)),
    }));
  }

  /** Optional one-tap RIR after the final prescribed set. Telemetry only. */
  setFinalRir(sessionId: string, esId: string, rir: number | undefined): void {
    this.updateExerciseSession(sessionId, esId, (es) => {
      const next = { ...es };
      if (rir == null) delete next.finalSetRir;
      else next.finalSetRir = rir;
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
        perHand: ex.perHand,
        perSide: ex.perSide,
        bodyweight: ex.bodyweight,
        substitutedFor: es.substitutedFor ?? es.name,
        suggestedWeight: weight,
        weight,
        sets: es.sets.map((set) => (set.reps == null ? { ...set, weight } : set)),
      };
      for (const k of ['timed', 'cue', 'gear', 'progressionId', 'level', 'levelCount', 'variationBasis', 'fromExerciseId', 'fromName'] as const) delete next[k];
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
   * Step one rung up or down the exercise's progression chain for THIS session. The substitute's own
   * history drives its added-load suggestion; the chain picks up from whatever is actually performed.
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
        perHand: target.perHand,
        perSide: target.perSide,
        bodyweight: target.bodyweight,
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

  // ── boxing ────────────────────────────────────────────

  /** One tap. Returns the record (existing one if that date is already logged). Details are optional and can be added later. */
  logBoxing(date = todayISO(), details: Partial<Pick<BoxingAttendance, 'durationMin' | 'rpe' | 'sessionType'>> = {}): BoxingAttendance {
    const existing = this.state.boxing.find((b) => b.date === date);
    if (existing) return existing;
    const rec: BoxingAttendance = { id: newId('bx'), date, loggedAt: Date.now(), ...stripUndefined(details) };
    this.set({ boxing: [...this.state.boxing, rec] });
    put('boxing', rec).catch(persistErr);
    return rec;
  }

  /** Add/change optional metadata on an existing boxing record. Passing undefined clears a field. */
  updateBoxing(id: string, patch: Partial<Pick<BoxingAttendance, 'durationMin' | 'rpe' | 'sessionType'>>): void {
    const cur = this.state.boxing.find((b) => b.id === id);
    if (!cur) return;
    const next: BoxingAttendance = { ...cur };
    for (const k of ['durationMin', 'rpe', 'sessionType'] as const) {
      if (!(k in patch)) continue;
      const v = patch[k];
      if (v == null) delete next[k];
      else (next as any)[k] = v;
    }
    this.set({ boxing: this.state.boxing.map((b) => (b.id === id ? next : b)) });
    put('boxing', next).catch(persistErr);
  }

  undoBoxing(date: string): void {
    const rec = this.state.boxing.find((b) => b.date === date);
    if (!rec) return;
    this.set({ boxing: this.state.boxing.filter((b) => b.id !== rec.id) });
    del('boxing', rec.id).catch(persistErr);
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
      if (isFlexPlan(plan)) {
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
      } else if (plan.schedule.some((d) => d.type === 'workout' && d.templateId === id)) {
        this.savePlan({
          ...plan,
          schedule: plan.schedule.map((d) =>
            d.type === 'workout' && d.templateId === id ? { type: 'rest' } : d,
          ),
        });
      }
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

  /** Add a resolved plan bundle. Adds only; history, boxing, measurements and settings are untouched. */
  async importPlanBundle(resolved: ResolvedBundle): Promise<string> {
    if (resolved.exercises.length) await bulkPut('exercises', resolved.exercises);
    if (resolved.templates.length) await bulkPut('templates', resolved.templates);
    await put('plans', resolved.plan);
    this.set({
      exercises: [...this.state.exercises, ...resolved.exercises],
      templates: [...this.state.templates, ...resolved.templates],
      plans: [...this.state.plans, resolved.plan],
    });
    return resolved.plan.id;
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
      boxing: s.boxing,
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
    await bulkPut('boxing', backup.boxing);
    await bulkPut('measurements', backup.measurements);
    await put('settings', { ...backup.settings, id: 'settings', schemaVersion: SCHEMA_VERSION });
    // a restored v1 backup gets the same one-time additions an upgraded install gets
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

function stripUndefined<T extends object>(o: T): T {
  const out = { ...o } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out as T;
}

export const store = new Store();

export function useAppState(): AppState {
  return useSyncExternalStore(store.subscribe, store.getSnapshot);
}
