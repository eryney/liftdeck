import type { WorkoutPlan, WorkoutSession, WorkoutTemplate } from '../types';
import { hoursBetween, todayISO } from './dates';
import { nextRotationTemplateId, optionalTemplateIds, rotationGoal, strengthTemplateIds, weekAttainment, workoutGoals } from './flex';

/**
 * Deterministic. No scores, no inference — the rules below, in order:
 *   1. strength below target and rested ≥ gap   → next session in the rotation
 *   2. strength below target, not rested         → rest (the next session is still one tap away)
 *   3. strength at target but below the soft max → next session offered as a bonus, if you feel good
 *   4. otherwise                                 → recovery
 * The optional session (Flow) is offered whenever strength is not the call today. Nothing is ever blocked.
 */

export const DEFAULT_MIN_GAP_HOURS = 20;

export type Primary =
  | { kind: 'strength'; templateId: string; reason: string }
  | { kind: 'bonus'; templateId: string; reason: string }
  | { kind: 'rest'; reason: string };

export interface Recommendation {
  primary: Primary;
  /** short, honest notes that matter today */
  notes: string[];
  strength: {
    nextTemplateId: string | null;
    count: number;
    minimum: number;
    target: number;
    max: number | null;
    hoursSinceLast: number | null;
    gapOk: boolean;
    minGapHours: number;
  };
  optional: { templateId: string; count: number; max: number | null; visible: boolean } | null;
  foundation: boolean;
  targetMet: boolean;
}

export interface RecommendInput {
  plan: WorkoutPlan;
  sessions: WorkoutSession[];
  templates?: WorkoutTemplate[];
  now?: number;
  today?: string;
}

export function lastStrengthSession(plan: WorkoutPlan, sessions: WorkoutSession[]): WorkoutSession | null {
  const ids = strengthTemplateIds(plan);
  const optional = optionalTemplateIds(plan);
  let best: WorkoutSession | null = null;
  for (const s of sessions) {
    if (s.status !== 'completed') continue;
    // any completed non-optional session counts as a strength exposure for recovery spacing
    const isStrength = s.templateId ? ids.includes(s.templateId) || !optional.includes(s.templateId) : true;
    if (!isStrength) continue;
    const t = s.finishedAt ?? s.startedAt;
    if (!best || t > (best.finishedAt ?? best.startedAt)) best = s;
  }
  return best;
}

export function recommend(input: RecommendInput): Recommendation {
  const now = input.now ?? Date.now();
  const today = input.today ?? todayISO();
  const { plan, sessions } = input;
  const week = weekAttainment({ plan, sessions, today }, today, input.templates ?? []);

  const rg = rotationGoal(plan);
  const optGoal = workoutGoals(plan).find((g) => g.optional) ?? null;

  const strengthCount = rg ? week.goals.find((g) => g.goal.id === rg.id)?.count ?? 0 : 0;
  const strengthMin = rg?.minimum ?? 0;
  const strengthTarget = rg?.target ?? 0;
  const strengthMax = rg?.max ?? null;
  const minGapHours = rg?.minGapHours ?? DEFAULT_MIN_GAP_HOURS;

  const lastStrength = lastStrengthSession(plan, sessions);
  const hoursSinceLast = lastStrength ? hoursBetween(lastStrength.finishedAt ?? lastStrength.startedAt, now) : null;
  const gapOk = hoursSinceLast == null || hoursSinceLast >= minGapHours;
  const nextTemplateId = rg ? nextRotationTemplateId(rg, sessions) : null;
  const strengthAtMax = strengthMax != null && strengthCount >= strengthMax;
  const strengthToday = sessions.some((s) => s.date === today && s.status === 'completed' && (!s.templateId || !optionalTemplateIds(plan).includes(s.templateId)));

  const accCount = optGoal ? week.goals.find((g) => g.goal.id === optGoal.id)?.count ?? 0 : 0;
  const accMax = optGoal?.max ?? null;
  const strengthWanted = !!rg && !!nextTemplateId && strengthCount < strengthTarget && !strengthAtMax;
  const optionalVisible = !!optGoal && (!strengthWanted || !gapOk) && (accMax == null || accCount < accMax);

  let primary: Primary;
  const notes: string[] = [];
  if (rg && nextTemplateId && strengthWanted && gapOk) {
    const left = strengthTarget - strengthCount;
    primary = {
      kind: 'strength',
      templateId: nextTemplateId,
      reason: strengthCount === 0 ? 'First session of the week' : `${strengthCount} of ${strengthTarget} this week · ${left} to go`,
    };
  } else if (rg && nextTemplateId && strengthWanted && !gapOk) {
    const h = Math.max(1, Math.ceil(minGapHours - (hoursSinceLast ?? 0)));
    primary = { kind: 'rest', reason: strengthToday ? 'Done for today' : `Rest · next session in about ${h} h` };
  } else if (rg && nextTemplateId && strengthCount >= strengthTarget && !strengthAtMax && gapOk) {
    primary = { kind: 'bonus', templateId: nextTemplateId, reason: `Week's target met · a 5th session is fine if you feel fresh` };
  } else {
    primary = { kind: 'rest', reason: week.target ? 'Week complete' : strengthAtMax ? 'Soft max reached · rest' : 'Rest' };
  }
  if (!gapOk && !strengthToday) notes.push(`Last session was ${Math.round(hoursSinceLast ?? 0)} h ago · the plan asks for ${minGapHours} h between sessions`);

  return {
    primary,
    notes,
    strength: { nextTemplateId, count: strengthCount, minimum: strengthMin, target: strengthTarget, max: strengthMax, hoursSinceLast, gapOk, minGapHours },
    optional: optGoal ? { templateId: optGoal.templateId, count: accCount, max: accMax, visible: optionalVisible } : null,
    foundation: week.foundation,
    targetMet: week.target,
  };
}
