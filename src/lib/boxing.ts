import type { BoxingAttendance, BoxingSessionType } from '../types';
import { addDays, parseISO, toISODate, weekStart } from './dates';

export const BOXING_TYPES: { id: BoxingSessionType; label: string }[] = [
  { id: 'technical', label: 'TECH' },
  { id: 'bag', label: 'BAG' },
  { id: 'sparring', label: 'SPAR' },
  { id: 'conditioning', label: 'COND' },
  { id: 'mixed', label: 'MIXED' },
];

export const HARD_BOXING_RPE = 8;
export const HARD_SPARRING_MIN_DURATION = 30;
export const HARD_BOXING_WINDOW_HOURS = 24;

/** duration × RPE, only when both exist. Rough telemetry, never adherence. */
export function boxingLoad(b: Pick<BoxingAttendance, 'durationMin' | 'rpe'>): number | null {
  if (typeof b.durationMin !== 'number' || typeof b.rpe !== 'number') return null;
  if (b.durationMin <= 0 || b.rpe <= 0) return null;
  return b.durationMin * b.rpe;
}

/** RPE ≥ 8, or sparring with meaningful duration. */
export function isHardBoxing(b: BoxingAttendance): boolean {
  if (typeof b.rpe === 'number' && b.rpe >= HARD_BOXING_RPE) return true;
  if (b.sessionType === 'sparring' && (b.durationMin ?? 0) >= HARD_SPARRING_MIN_DURATION) return true;
  return false;
}

/** Best-guess timestamp of a boxing session: loggedAt when it was logged the same day, else midday of that date. */
export function boxingTimestamp(b: BoxingAttendance): number {
  if (b.loggedAt && toISODate(new Date(b.loggedAt)) === b.date) return b.loggedAt;
  const d = parseISO(b.date);
  d.setHours(12, 0, 0, 0);
  return d.getTime();
}

export function hardBoxingWithin(boxing: BoxingAttendance[], nowMs: number, hours = HARD_BOXING_WINDOW_HOURS): BoxingAttendance | null {
  let latest: BoxingAttendance | null = null;
  for (const b of boxing) {
    if (!isHardBoxing(b)) continue;
    const t = boxingTimestamp(b);
    if (t > nowMs + 60000) continue;
    if (nowMs - t <= hours * 3600000 && (!latest || t > boxingTimestamp(latest))) latest = b;
  }
  return latest;
}

export interface BoxingWeekStats {
  weekStart: string;
  count: number;
  minutes: number | null;
  /** sum of duration×RPE over sessions that have both */
  load: number | null;
  types: Partial<Record<BoxingSessionType, number>>;
}

export function boxingWeekStats(boxing: BoxingAttendance[], weekStartISO: string): BoxingWeekStats {
  const end = addDays(weekStartISO, 6);
  const inWeek = boxing.filter((b) => b.date >= weekStartISO && b.date <= end);
  let minutes = 0;
  let hasMinutes = false;
  let load = 0;
  let hasLoad = false;
  const types: Partial<Record<BoxingSessionType, number>> = {};
  for (const b of inWeek) {
    if (typeof b.durationMin === 'number' && b.durationMin > 0) {
      minutes += b.durationMin;
      hasMinutes = true;
    }
    const l = boxingLoad(b);
    if (l != null) {
      load += l;
      hasLoad = true;
    }
    if (b.sessionType) types[b.sessionType] = (types[b.sessionType] ?? 0) + 1;
  }
  return { weekStart: weekStartISO, count: inWeek.length, minutes: hasMinutes ? minutes : null, load: hasLoad ? load : null, types };
}

/** Weekly stats for the last N weeks ending with the week containing `today` (oldest first). */
export function boxingLastWeeks(boxing: BoxingAttendance[], today: string, weeks = 8): BoxingWeekStats[] {
  const cur = weekStart(today);
  const out: BoxingWeekStats[] = [];
  for (let i = weeks - 1; i >= 0; i--) out.push(boxingWeekStats(boxing, addDays(cur, -7 * i)));
  return out;
}

export function boxingTypeLabel(t: BoxingSessionType | undefined): string {
  return BOXING_TYPES.find((x) => x.id === t)?.label ?? '';
}
