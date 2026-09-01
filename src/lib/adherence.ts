import type { BoxingAttendance, DayActivity, WorkoutPlan, WorkoutSession } from '../types';
import { addDays, todayISO, weekStart, weekdayIndex } from './dates';

export type DayStatus =
  | 'rest'
  | 'completed'
  | 'missed'
  | 'upcoming' // today or future, planned, not yet done
  | 'optional-skipped'
  | 'optional-completed'
  | 'before-start';

export interface DayInfo {
  date: string;
  activity: DayActivity;
  status: DayStatus;
}

export interface AdherenceContext {
  plan: WorkoutPlan | null;
  sessions: WorkoutSession[];
  boxing: BoxingAttendance[];
  startDate: string;
  today?: string;
}

function isDone(activity: DayActivity, date: string, ctx: AdherenceContext): boolean {
  if (activity.type === 'boxing') return ctx.boxing.some((b) => b.date === date);
  if (activity.type === 'workout') {
    return ctx.sessions.some((s) => s.date === date && s.status === 'completed');
  }
  return false;
}

export function dayInfo(date: string, ctx: AdherenceContext): DayInfo {
  const today = ctx.today ?? todayISO();
  const activity: DayActivity = ctx.plan ? ctx.plan.schedule[weekdayIndex(date)] : { type: 'rest' };
  // extra-credit: activity logged on a rest day still shows as completed
  if (activity.type === 'rest') {
    const boxed = ctx.boxing.some((b) => b.date === date);
    const lifted = ctx.sessions.some((s) => s.date === date && s.status === 'completed');
    if (boxed || lifted) return { date, activity, status: 'optional-completed' };
    return { date, activity, status: 'rest' };
  }
  if (date < ctx.startDate) return { date, activity, status: 'before-start' };
  const done = isDone(activity, date, ctx);
  const optional = 'optional' in activity && !!activity.optional;
  if (done) return { date, activity, status: optional ? 'optional-completed' : 'completed' };
  if (date >= today) return { date, activity, status: 'upcoming' };
  return { date, activity, status: optional ? 'optional-skipped' : 'missed' };
}

export interface PeriodStats {
  required: number;
  completed: number;
  optionalCompleted: number;
}

export function periodStats(from: string, to: string, ctx: AdherenceContext): PeriodStats {
  const today = ctx.today ?? todayISO();
  let required = 0;
  let completed = 0;
  let optionalCompleted = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const info = dayInfo(d, ctx);
    if (info.status === 'before-start' || info.status === 'rest') continue;
    const optional = 'optional' in info.activity && !!info.activity.optional;
    if (info.activity.type !== 'rest' && !optional) {
      // count required slots only up to today (future days aren't demands yet)
      if (d <= today) required += 1;
      if (info.status === 'completed') completed += 1;
    } else if (info.status === 'optional-completed') {
      optionalCompleted += 1;
    }
  }
  return { required, completed, optionalCompleted };
}

/** Required sessions this week (Mon..Sun), regardless of today — for the "3 / 6 this week" display */
export function weekPlanStats(ctx: AdherenceContext, today = todayISO()) {
  const start = weekStart(today);
  let planned = 0;
  let completed = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(start, i);
    const activity: DayActivity = ctx.plan ? ctx.plan.schedule[weekdayIndex(d)] : { type: 'rest' };
    if (activity.type === 'rest') continue;
    if ('optional' in activity && activity.optional) continue;
    planned += 1;
    if (isDone(activity, d, ctx)) completed += 1;
  }
  return { planned, completed };
}

/** Consecutive required sessions completed, walking back from today. Today/future don't break it. */
export function currentStreak(ctx: AdherenceContext, today = todayISO()): number {
  let streak = 0;
  for (let d = today; d >= ctx.startDate; d = addDays(d, -1)) {
    const info = dayInfo(d, ctx);
    if (info.status === 'before-start') break;
    const optional = 'optional' in info.activity && !!info.activity.optional;
    if (info.activity.type === 'rest' || optional) continue;
    if (info.status === 'completed') streak += 1;
    else if (d === today) continue; // today not done yet ≠ broken
    else break;
  }
  return streak;
}
