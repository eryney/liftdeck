import type {
  BoxingAttendance, FixedWorkoutPlan, FlexWorkoutPlan, WeeklyGoal, WorkoutPlan, WorkoutSession, WorkoutTemplate,
} from '../types';
import { addDays, todayISO, weekStart } from './dates';

// ── plan helpers ──────────────────────────────────────────────────────────

export function isFlexPlan(plan: WorkoutPlan | null | undefined): plan is FlexWorkoutPlan {
  return !!plan && (plan as FlexWorkoutPlan).mode === 'flex';
}

/** Old records have no `mode`; they are fixed plans. */
export function isFixedPlan(plan: WorkoutPlan | null | undefined): plan is FixedWorkoutPlan {
  return !!plan && (plan as FlexWorkoutPlan).mode !== 'flex';
}

export function planMode(plan: WorkoutPlan): 'fixed' | 'flex' {
  return isFlexPlan(plan) ? 'flex' : 'fixed';
}

export function boxingGoal(plan: FlexWorkoutPlan) {
  return plan.weeklyGoals.find((g): g is Extract<WeeklyGoal, { kind: 'boxing' }> => g.kind === 'boxing') ?? null;
}

export function rotationGoal(plan: FlexWorkoutPlan) {
  return plan.weeklyGoals.find((g): g is Extract<WeeklyGoal, { kind: 'rotation' }> => g.kind === 'rotation') ?? null;
}

export function workoutGoals(plan: FlexWorkoutPlan) {
  return plan.weeklyGoals.filter((g): g is Extract<WeeklyGoal, { kind: 'workout' }> => g.kind === 'workout');
}

/** Template ids that count as "strength" for gap/recovery purposes: rotation templates plus non-optional workout goals. */
export function strengthTemplateIds(plan: FlexWorkoutPlan): string[] {
  const ids: string[] = [];
  for (const g of plan.weeklyGoals) {
    if (g.kind === 'rotation') ids.push(...g.templateIds);
    if (g.kind === 'workout' && !g.optional) ids.push(g.templateId);
  }
  return ids;
}

export function optionalTemplateIds(plan: FlexWorkoutPlan): string[] {
  return workoutGoals(plan).filter((g) => g.optional).map((g) => g.templateId);
}

export function goalLabel(goal: WeeklyGoal, templates: WorkoutTemplate[] = []): string {
  if (goal.kind === 'boxing') return 'BOXING';
  if (goal.kind === 'rotation') return 'STRENGTH';
  if (goal.optional) return 'OPTIONAL';
  return templates.find((t) => t.id === goal.templateId)?.name ?? 'WORKOUT';
}

// ── weekly attainment ─────────────────────────────────────────────────────

export interface FlexContext {
  plan: FlexWorkoutPlan;
  sessions: WorkoutSession[];
  boxing: BoxingAttendance[];
  startDate?: string;
  today?: string;
}

function completedInRange(sessions: WorkoutSession[], from: string, to: string): WorkoutSession[] {
  return sessions.filter((s) => s.status === 'completed' && s.date >= from && s.date <= to);
}

export function goalCount(goal: WeeklyGoal, ctx: Pick<FlexContext, 'sessions' | 'boxing'>, from: string, to: string): number {
  if (goal.kind === 'boxing') return ctx.boxing.filter((b) => b.date >= from && b.date <= to).length;
  const done = completedInRange(ctx.sessions, from, to);
  if (goal.kind === 'rotation') return done.filter((s) => !!s.templateId && goal.templateIds.includes(s.templateId)).length;
  return done.filter((s) => s.templateId === goal.templateId).length;
}

export interface GoalAttainment {
  goal: WeeklyGoal;
  label: string;
  count: number;
  minimum: number;
  target: number;
  max?: number;
  minMet: boolean;
  targetMet: boolean;
  optional: boolean;
}

export interface WeekAttainment {
  weekStart: string;
  weekEnd: string;
  goals: GoalAttainment[];
  /** every non-optional goal reached its minimum */
  foundation: boolean;
  /** every non-optional goal reached its target */
  target: boolean;
}

export function weekAttainment(ctx: FlexContext, date: string = ctx.today ?? todayISO(), templates: WorkoutTemplate[] = []): WeekAttainment {
  const from = weekStart(date);
  const to = addDays(from, 6);
  const goals = ctx.plan.weeklyGoals.map((goal): GoalAttainment => {
    const count = goalCount(goal, ctx, from, to);
    const optional = goal.kind === 'workout' && !!goal.optional;
    return {
      goal,
      label: goalLabel(goal, templates),
      count,
      minimum: goal.minimum,
      target: goal.target,
      max: goal.max,
      minMet: count >= goal.minimum,
      targetMet: count >= goal.target,
      optional,
    };
  });
  const core = goals.filter((g) => !g.optional);
  return {
    weekStart: from,
    weekEnd: to,
    goals,
    foundation: core.every((g) => g.minMet),
    target: core.every((g) => g.targetMet),
  };
}

/** Consecutive weeks (walking back from the current week) meeting the foundation minimums. The current week counts if already met, and never breaks the streak if not yet. */
export function foundationStreak(ctx: FlexContext, today: string = ctx.today ?? todayISO()): number {
  const start = ctx.startDate ?? '0000-01-01';
  let streak = 0;
  let ws = weekStart(today);
  const cur = weekAttainment(ctx, ws);
  if (cur.foundation) streak += 1;
  ws = addDays(ws, -7);
  for (let guard = 0; guard < 520; guard++) {
    if (addDays(ws, 6) < start) break; // week ended before tracking began
    const w = weekAttainment(ctx, ws);
    if (!w.foundation) break;
    streak += 1;
    ws = addDays(ws, -7);
  }
  return streak;
}

/** How many of the previous N complete weeks hit the full target. */
export function targetWeeks(ctx: FlexContext, today: string = ctx.today ?? todayISO(), n = 8): { hit: number; of: number } {
  const start = ctx.startDate ?? '0000-01-01';
  let hit = 0;
  let of = 0;
  let ws = addDays(weekStart(today), -7);
  for (let i = 0; i < n; i++) {
    if (addDays(ws, 6) < start) break;
    of += 1;
    if (weekAttainment(ctx, ws).target) hit += 1;
    ws = addDays(ws, -7);
  }
  return { hit, of };
}

// ── rotation ──────────────────────────────────────────────────────────────

/** Next template in the rotation, determined ONLY by the most recently completed rotation session. */
export function nextRotationTemplateId(goal: Extract<WeeklyGoal, { kind: 'rotation' }>, sessions: WorkoutSession[]): string | null {
  if (goal.templateIds.length === 0) return null;
  const last = [...sessions]
    .filter((s) => s.status === 'completed' && !!s.templateId && goal.templateIds.includes(s.templateId))
    .sort((a, b) => (b.finishedAt ?? b.startedAt) - (a.finishedAt ?? a.startedAt))[0];
  if (!last) return goal.templateIds[0];
  const idx = goal.templateIds.indexOf(last.templateId as string);
  return goal.templateIds[(idx + 1) % goal.templateIds.length];
}

export function rotationLetter(goal: Extract<WeeklyGoal, { kind: 'rotation' }> | null, templateId: string | undefined): string | null {
  if (!goal || !templateId) return null;
  const idx = goal.templateIds.indexOf(templateId);
  return idx >= 0 ? String.fromCharCode(65 + idx) : null;
}

// ── training record (calendar) ────────────────────────────────────────────

export interface DayRecord {
  date: string;
  /** e.g. ['BOX', 'A'] — empty for a blank day (which is neutral, never "missed") */
  tags: string[];
  boxing: BoxingAttendance[];
  sessions: WorkoutSession[];
}

export function sessionTag(session: WorkoutSession, plan: FlexWorkoutPlan): string {
  const rot = rotationGoal(plan);
  const letter = rotationLetter(rot, session.templateId);
  if (letter) return letter;
  if (session.templateId && optionalTemplateIds(plan).includes(session.templateId)) return 'ACC';
  return session.name.replace(/[^A-Z0-9]/gi, '').slice(0, 3).toUpperCase() || 'WK';
}

export function dayRecord(date: string, ctx: FlexContext): DayRecord {
  const boxing = ctx.boxing.filter((b) => b.date === date);
  const sessions = ctx.sessions.filter((s) => s.date === date && s.status === 'completed').sort((a, b) => a.startedAt - b.startedAt);
  const tags: string[] = [];
  if (boxing.length > 0) tags.push('BOX');
  for (const s of sessions) tags.push(sessionTag(s, ctx.plan));
  return { date, tags, boxing, sessions };
}

/** Compact "BOX 3/4 · STR 2/2" for a week. Optional goals are omitted unless done. */
export function weekSummaryLine(w: WeekAttainment): string {
  const parts: string[] = [];
  for (const g of w.goals) {
    if (g.optional) {
      if (g.count > 0) parts.push(`OPT ${g.count}`);
      continue;
    }
    const short = g.goal.kind === 'boxing' ? 'BOX' : g.goal.kind === 'rotation' ? 'STR' : g.label.slice(0, 3);
    parts.push(`${short} ${g.count}/${g.target}`);
  }
  return parts.join(' · ');
}
