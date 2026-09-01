import { useSyncExternalStore } from 'react';
import type {
  AppSettings, BodyMeasurement, BoxingAttendance, DayActivity, Exercise,
  ExerciseSession, TemplateExercise, WorkoutPlan, WorkoutSession, WorkoutTemplate,
} from '../types';
import { bulkPut, clearAllStores, defaultSettings, del, loadAll, put } from '../lib/db';
import type { DBShape } from '../lib/db';
import { EXERCISE_LIBRARY } from '../data/exercises';
import { SEED_PLAN, SEED_TEMPLATES } from '../data/seedPlan';
import { newId } from '../lib/ids';
import { todayISO, weekdayIndex } from '../lib/dates';
import { computeResult, suggestWeight } from '../lib/progression';
import type { BackupFile } from '../types';

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
      data = await loadAll();
    } else if (data.exercises.length === 0) {
      await bulkPut('exercises', EXERCISE_LIBRARY);
      data = await loadAll();
    }
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

  private async seed(): Promise<void> {
    await bulkPut('exercises', EXERCISE_LIBRARY);
    await bulkPut('templates', SEED_TEMPLATES);
    await put('plans', SEED_PLAN);
    await put('settings', defaultSettings());
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

  activityFor(date: string): DayActivity {
    const plan = this.activePlan();
    return plan ? plan.schedule[weekdayIndex(date)] : { type: 'rest' };
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

  private buildExerciseSession(tpl: TemplateExercise): ExerciseSession {
    const ex = this.exerciseById(tpl.exerciseId);
    const { weight } = suggestWeight(this.state.sessions, tpl.exerciseId, tpl);
    return {
      id: newId('es'),
      exerciseId: tpl.exerciseId,
      name: ex?.name ?? tpl.exerciseId,
      perHand: ex?.perHand,
      perSide: ex?.perSide,
      bodyweight: ex?.bodyweight,
      targetSets: tpl.sets,
      repMin: tpl.repMin,
      repMax: tpl.repMax,
      restSec: tpl.restSec,
      increment: tpl.increment,
      suggestedWeight: weight,
      weight,
      sets: Array.from({ length: tpl.sets }, () => ({ reps: null, weight })),
    };
  }

  startWorkout(templateId: string, date = todayISO()): string {
    const tpl = this.templateById(templateId);
    if (!tpl) throw new Error('template not found');
    const session: WorkoutSession = {
      id: newId('ws'),
      date,
      name: tpl.name,
      templateId,
      status: 'active',
      startedAt: Date.now(),
      exercises: tpl.exercises.map((te) => this.buildExerciseSession(te)),
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
    this.updateSession(sessionId, (s) => {
      const exercises = s.exercises.map((es) => {
        if (es.id !== esId) return es;
        const sets = es.sets.map((set, i) =>
          i === setIdx ? { ...set, reps, weight: reps == null ? set.weight : es.weight, loggedAt: Date.now() } : set,
        );
        const next = { ...es, sets };
        if (s.status === 'completed') next.result = computeResult(next);
        return next;
      });
      return { ...s, exercises };
    });
  }

  /** Change working weight; applies to unlogged sets (and optionally a specific logged set). */
  setExerciseWeight(sessionId: string, esId: string, weight: number): void {
    this.updateExerciseSession(sessionId, esId, (es) => ({
      ...es,
      weight,
      sets: es.sets.map((set) => (set.reps == null ? { ...set, weight } : set)),
    }));
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

  substituteExercise(sessionId: string, esId: string, newExerciseId: string, replaceInPlan: boolean): void {
    const ex = this.exerciseById(newExerciseId);
    if (!ex) return;
    const session = this.state.sessions.find((s) => s.id === sessionId);
    const old = session?.exercises.find((e) => e.id === esId);
    if (!session || !old) return;
    const tplLike = { increment: old.increment, startWeight: 0 };
    const { weight } = suggestWeight(this.state.sessions, newExerciseId, tplLike);
    this.updateExerciseSession(sessionId, esId, (es) => ({
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
    }));
    if (replaceInPlan && session.templateId) {
      const tpl = this.templateById(session.templateId);
      if (tpl) {
        const idx = tpl.exercises.findIndex((te) => te.exerciseId === old.exerciseId);
        if (idx >= 0) {
          const exercises = tpl.exercises.map((te, i) =>
            i === idx ? { ...te, exerciseId: newExerciseId } : te,
          );
          this.saveTemplate({ ...tpl, exercises });
        }
      }
    }
  }

  finishWorkout(sessionId: string): WorkoutSession | null {
    const finished = this.updateSession(sessionId, (s) => ({
      ...s,
      status: 'completed' as const,
      finishedAt: Date.now(),
      exercises: s.exercises.map((es) => ({ ...es, result: computeResult(es) })),
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

  logBoxing(date = todayISO()): void {
    if (this.state.boxing.some((b) => b.date === date)) return;
    const rec: BoxingAttendance = { id: newId('bx'), date, loggedAt: Date.now() };
    this.set({ boxing: [...this.state.boxing, rec] });
    put('boxing', rec).catch(persistErr);
  }

  undoBoxing(date: string): void {
    const rec = this.state.boxing.find((b) => b.date === date);
    if (!rec) return;
    this.set({ boxing: this.state.boxing.filter((b) => b.id !== rec.id) });
    del('boxing', rec.id).catch(persistErr);
  }

  // ── body measurements ─────────────────────────────────

  addMeasurement(date: string, weightLb: number, waistIn?: number): void {
    // one measurement per date: replace existing
    const existing = this.state.measurements.find((m) => m.date === date);
    const rec: BodyMeasurement = {
      id: existing?.id ?? newId('bm'),
      date,
      weightLb,
      waistIn,
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
    // remove from plan schedules
    for (const plan of this.state.plans) {
      if (plan.schedule.some((d) => d.type === 'workout' && d.templateId === id)) {
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

  async importBackup(backup: BackupFile): Promise<void> {
    await clearAllStores();
    await bulkPut('exercises', backup.exercises);
    await bulkPut('templates', backup.templates);
    await bulkPut('plans', backup.plans);
    await bulkPut('sessions', backup.sessions);
    await bulkPut('boxing', backup.boxing);
    await bulkPut('measurements', backup.measurements);
    await put('settings', { ...backup.settings, id: 'settings' });
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
