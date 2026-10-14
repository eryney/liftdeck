import type { BoxingAttendance, FlexWorkoutPlan, WorkoutSession, WorkoutTemplate } from '../types';
import { hardBoxingWithin } from './boxing';
import { hoursBetween, todayISO } from './dates';
import { boxingGoal, nextRotationTemplateId, optionalTemplateIds, rotationGoal, strengthTemplateIds, weekAttainment, workoutGoals } from './flex';

/**
 * Deterministic priority engine. No scores, no inference — just the rules below, in order:
 *   1. strength floor (0 this week and rested ≥ gap)  → next A/B
 *   2. boxing below minimum                          → boxing (unless already logged today)
 *   3. strength below target (and rested)            → next A/B
 *   4. boxing below target                           → boxing
 *   5. otherwise                                     → recovery, or the optional session if it's a good day for it
 * The optional session is also offered as a secondary choice whenever strength is not the call (not rested, or done).
 * Boxing is always available regardless of what is recommended. Nothing is ever blocked.
 */

export const DEFAULT_MIN_GAP_HOURS = 36;

export type Primary =
  | { kind: 'strength'; templateId: string; reason: string }
  | { kind: 'boxing'; reason: string }
  | { kind: 'accessory'; templateId: string; reason: string }
  | { kind: 'recovery'; reason: string };

export interface RecoveryNote {
  id: 'strength-gap' | 'hard-boxing' | 'same-day';
  text: string;
}

export interface Recommendation {
  primary: Primary;
  notes: RecoveryNote[];
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
  boxing: { count: number; minimum: number; target: number; boxedToday: boolean };
  accessory: { templateId: string; count: number; max: number | null; visible: boolean } | null;
  hardBoxingRecent: boolean;
  foundation: boolean;
  targetMet: boolean;
}

export interface RecommendInput {
  plan: FlexWorkoutPlan;
  sessions: WorkoutSession[];
  boxing: BoxingAttendance[];
  templates?: WorkoutTemplate[];
  now?: number;
  today?: string;
}

export function lastStrengthSession(plan: FlexWorkoutPlan, sessions: WorkoutSession[]): WorkoutSession | null {
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
  const { plan, sessions, boxing } = input;
  const week = weekAttainment({ plan, sessions, boxing, today }, today, input.templates ?? []);

  const bg = boxingGoal(plan);
  const rg = rotationGoal(plan);
  const optGoal = workoutGoals(plan).find((g) => g.optional) ?? null;

  const boxingCount = bg ? week.goals.find((g) => g.goal.id === bg.id)?.count ?? 0 : 0;
  const boxingMin = bg?.minimum ?? 0;
  const boxingTarget = bg?.target ?? 0;
  const boxedToday = boxing.some((b) => b.date === today);

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

  const hard = hardBoxingWithin(boxing, now);
  const hardBoxingRecent = !!hard;

  const accCount = optGoal ? week.goals.find((g) => g.goal.id === optGoal.id)?.count ?? 0 : 0;
  const accMax = optGoal?.max ?? null;
  // The optional session is low-fatigue practice: offered whenever strength is not the call today
  // (target reached, soft max reached, or not yet rested), boxing is at its minimum, and its own cap is not hit.
  const strengthWanted = !!rg && !!nextTemplateId && strengthCount < strengthTarget && !strengthAtMax;
  const accessoryVisible =
    !!optGoal &&
    (!strengthWanted || !gapOk) &&
    boxingCount >= boxingMin &&
    !hardBoxingRecent &&
    (accMax == null || accCount < accMax);

  // one boxing record per day: once today's is logged, "box" is not a useful next step until tomorrow
  const canBox = !!bg && !boxedToday;
  let primary: Primary;
  if (rg && nextTemplateId && strengthCount === 0 && gapOk) {
    primary = { kind: 'strength', templateId: nextTemplateId, reason: 'STRENGTH FLOOR · first exposure this week' };
  } else if (canBox && boxingCount < boxingMin) {
    primary = { kind: 'boxing', reason: `BOXING MINIMUM · ${boxingCount} of ${boxingMin}` };
  } else if (rg && nextTemplateId && strengthCount < strengthTarget && !strengthAtMax && gapOk) {
    primary = { kind: 'strength', templateId: nextTemplateId, reason: `STRENGTH TARGET · ${strengthCount} of ${strengthTarget}` };
  } else if (canBox && boxingCount < boxingTarget) {
    primary = { kind: 'boxing', reason: `BOXING TARGET · ${boxingCount} of ${boxingTarget}` };
  } else if (accessoryVisible && optGoal && (week.target || strengthAtMax)) {
    primary = { kind: 'accessory', templateId: optGoal.templateId, reason: 'CORE TARGETS MET · optional session if you feel good' };
  } else if (boxedToday && !week.target) {
    const next = rg && nextTemplateId && strengthCount < strengthTarget && !strengthAtMax ? (gapOk ? 'next strength when you have time' : 'next strength once rested') : 'more boxing counts from tomorrow';
    primary = { kind: 'recovery', reason: `BOXING LOGGED TODAY · ${next}` };
  } else {
    primary = { kind: 'recovery', reason: week.target ? 'TARGET WEEK COMPLETE' : 'RECOVERY · nothing is owed today' };
  }

  const notes: RecoveryNote[] = [];
  if (!gapOk) notes.push({ id: 'strength-gap', text: 'RECENT STRENGTH SESSION · consider more recovery' });
  if (hardBoxingRecent) notes.push({ id: 'hard-boxing', text: "HARD BOXING RECENTLY · keep today's lifting crisp" });
  const strengthToday = sessions.some((s) => s.date === today && s.status === 'completed' && (!s.templateId || !optionalTemplateIds(plan).includes(s.templateId)));
  if (boxedToday !== strengthToday) {
    notes.push({ id: 'same-day', text: 'If practical, separate boxing and lifting by 3+ hours. If not, prioritize boxing quality.' });
  }

  return {
    primary,
    notes,
    strength: { nextTemplateId, count: strengthCount, minimum: strengthMin, target: strengthTarget, max: strengthMax, hoursSinceLast, gapOk, minGapHours },
    boxing: { count: boxingCount, minimum: boxingMin, target: boxingTarget, boxedToday },
    accessory: optGoal ? { templateId: optGoal.templateId, count: accCount, max: accMax, visible: accessoryVisible } : null,
    hardBoxingRecent,
    foundation: week.foundation,
    targetMet: week.target,
  };
}
