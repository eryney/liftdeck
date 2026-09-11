import type { BodyMeasurement } from '../types';
import { addDays, daysBetween } from './dates';

export interface DatedValue {
  date: string;
  value: number;
}

/** Simple trailing moving average (calendar-day window ending on each point's date). */
export function movingAverage(points: DatedValue[], windowDays: number): DatedValue[] {
  const sorted = [...points].sort((a, b) => (a.date < b.date ? -1 : 1));
  return sorted.map((p, i) => {
    const windowStart = addDays(p.date, -(windowDays - 1));
    const inWindow = sorted.slice(0, i + 1).filter((q) => q.date >= windowStart);
    const avg = inWindow.reduce((s, q) => s + q.value, 0) / inWindow.length;
    return { date: p.date, value: Math.round(avg * 10) / 10 };
  });
}

/** Least-squares slope in value units per day, over the given points. Needs ≥2 points spanning ≥1 day. */
export function regressionSlopePerDay(points: DatedValue[]): number | null {
  if (points.length < 2) return null;
  const t0 = points[0].date;
  const xs = points.map((p) => daysBetween(t0, p.date));
  const ys = points.map((p) => p.value);
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (ys[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  if (den === 0) return null;
  return num / den;
}

export interface WeightTrend {
  latest: number;
  latestDate: string;
  /** moving average at the latest point */
  avg: number;
  /** avg now minus avg ~7 days earlier (null if no earlier data) */
  change7: number | null;
  /** avg now minus avg ~28 days earlier */
  change28: number | null;
  /** regression slope over the trailing 28 days, lb/week */
  lbPerWeek: number | null;
  /** slope as % of mean bodyweight per week */
  pctPerWeek: number | null;
  /** days of data the slope is based on */
  slopeSpanDays: number;
}

function avgAtOrBefore(ma: DatedValue[], date: string): DatedValue | null {
  let out: DatedValue | null = null;
  for (const p of ma) {
    if (p.date <= date) out = p;
    else break;
  }
  return out;
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Weight trend from raw measurements. Changes compare the moving average at two points;
 * the weekly rate comes from a regression over the trailing 28 days (min 2 points, ≥6 days apart)
 * so two noisy daily readings never define the trend.
 */
export function weightTrend(measurements: BodyMeasurement[], windowDays = 7): WeightTrend | null {
  const raw = measurements
    .map((m) => ({ date: m.date, value: m.weightLb }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (raw.length === 0) return null;
  const ma = movingAverage(raw, windowDays);
  const latest = raw[raw.length - 1];
  const latestMA = ma[ma.length - 1];
  const at7 = avgAtOrBefore(ma, addDays(latest.date, -7));
  const at28 = avgAtOrBefore(ma, addDays(latest.date, -28));
  const window = raw.filter((p) => p.date >= addDays(latest.date, -28));
  const span = window.length >= 2 ? daysBetween(window[0].date, window[window.length - 1].date) : 0;
  let lbPerWeek: number | null = null;
  let pctPerWeek: number | null = null;
  if (window.length >= 2 && span >= 6) {
    const slope = regressionSlopePerDay(window);
    if (slope != null) {
      lbPerWeek = r2(slope * 7);
      const mean = window.reduce((s, p) => s + p.value, 0) / window.length;
      pctPerWeek = r2(((slope * 7) / mean) * 100);
    }
  }
  return {
    latest: latest.value,
    latestDate: latest.date,
    avg: latestMA.value,
    change7: at7 ? r1(latestMA.value - at7.value) : null,
    change28: at28 ? r1(latestMA.value - at28.value) : null,
    lbPerWeek,
    pctPerWeek,
    slopeSpanDays: span,
  };
}

export interface WaistTrend {
  latest: number;
  latestDate: string;
  /** latest minus the nearest reading at or before 28 days earlier */
  change28: number | null;
  points: DatedValue[];
}

export function waistTrend(measurements: BodyMeasurement[]): WaistTrend | null {
  const pts = measurements
    .filter((m) => typeof m.waistIn === 'number' && m.waistIn > 0)
    .map((m) => ({ date: m.date, value: m.waistIn as number }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  if (pts.length === 0) return null;
  const latest = pts[pts.length - 1];
  const prior = avgAtOrBefore(pts, addDays(latest.date, -28));
  return {
    latest: latest.value,
    latestDate: latest.date,
    change28: prior ? r1(latest.value - prior.value) : null,
    points: pts,
  };
}

/** Body weight nearest to a date within ±maxDays, for total-system-load telemetry. */
export function bodyweightNear(measurements: BodyMeasurement[], date: string, maxDays = 7): number | null {
  let best: { d: number; w: number } | null = null;
  for (const m of measurements) {
    const d = Math.abs(daysBetween(m.date, date));
    if (d <= maxDays && (!best || d < best.d)) best = { d, w: m.weightLb };
  }
  return best ? best.w : null;
}

export function fmtDelta(n: number | null, unit = ''): string {
  if (n == null) return '—';
  const s = n > 0 ? `+${n}` : `${n}`;
  return unit ? `${s} ${unit}` : s;
}
