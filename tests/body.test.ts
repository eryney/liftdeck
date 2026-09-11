import { describe, expect, it } from 'vitest';
import { bodyweightNear, movingAverage, regressionSlopePerDay, waistTrend, weightTrend } from '../src/lib/body';
import type { BodyMeasurement } from '../src/types';

let n = 0;
const m = (date: string, weightLb: number, waistIn?: number): BodyMeasurement => ({ id: `m${++n}`, date, weightLb, ...(waistIn != null ? { waistIn } : {}), loggedAt: 1 });

describe('movingAverage', () => {
  it('averages within the trailing window', () => {
    const pts = [
      { date: '2026-08-01', value: 180 },
      { date: '2026-08-02', value: 182 },
      { date: '2026-08-03', value: 181 },
    ];
    const ma = movingAverage(pts, 7);
    expect(ma[0].value).toBe(180);
    expect(ma[1].value).toBe(181);
    expect(ma[2].value).toBeCloseTo(181, 1);
  });

  it('drops points outside the window', () => {
    const ma = movingAverage([{ date: '2026-08-01', value: 100 }, { date: '2026-08-20', value: 200 }], 7);
    expect(ma[1].value).toBe(200);
  });
});

describe('weightTrend', () => {
  // steady 1 lb/week loss with daily noise, 5 weeks
  const series: BodyMeasurement[] = [];
  for (let d = 0; d < 35; d++) {
    const date = new Date(2026, 7, 1 + d); // Aug 1 ...
    const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const noise = [0.4, -0.3, 0.1, -0.2, 0.3, -0.4, 0.1][d % 7];
    series.push(m(iso, 185 - d / 7 + noise));
  }

  it('reports current avg, 7d and 4-week change from the moving average', () => {
    const t = weightTrend(series, 7)!;
    expect(t.avg).toBeGreaterThan(179);
    expect(t.avg).toBeLessThan(182);
    expect(t.change7).toBeCloseTo(-1, 0);
    expect(t.change28).toBeCloseTo(-4, 0);
  });

  it('lb/week trend comes from a regression, not two arbitrary days', () => {
    const t = weightTrend(series, 7)!;
    expect(t.lbPerWeek).toBeCloseTo(-1, 1);
    expect(t.slopeSpanDays).toBe(28);
  });

  it('%/week trend is relative to mean bodyweight', () => {
    const t = weightTrend(series, 7)!;
    expect(t.pctPerWeek).toBeCloseTo((-1 / 181) * 100, 1);
  });

  it('needs ≥6 days of span before quoting a rate; single reading still works', () => {
    const one = weightTrend([m('2026-08-01', 180)])!;
    expect(one.avg).toBe(180);
    expect(one.change7).toBeNull();
    expect(one.lbPerWeek).toBeNull();
    const two = weightTrend([m('2026-08-01', 180), m('2026-08-03', 179)])!;
    expect(two.lbPerWeek).toBeNull();
    expect(weightTrend([])).toBeNull();
  });

  it('regression helper', () => {
    expect(regressionSlopePerDay([{ date: '2026-08-01', value: 10 }, { date: '2026-08-11', value: 20 }])).toBeCloseTo(1, 5);
    expect(regressionSlopePerDay([{ date: '2026-08-01', value: 10 }])).toBeNull();
  });

  it('never produces a body-fat estimate or calorie advice', () => {
    const t = weightTrend(series, 7)!;
    const keys = Object.keys(t).join(' ').toLowerCase();
    expect(keys).not.toMatch(/fat|calor|kcal|macro/);
  });
});

describe('waistTrend', () => {
  it('graphs only entries that have a waist and computes the 4-week change', () => {
    const t = waistTrend([m('2026-08-01', 185, 36), m('2026-08-10', 184), m('2026-08-15', 183.5, 35.5), m('2026-08-30', 182, 35)])!;
    expect(t.points.map((p) => p.value)).toEqual([36, 35.5, 35]);
    expect(t.latest).toBe(35);
    expect(t.change28).toBe(-1);
  });

  it('handles missing waist data', () => {
    expect(waistTrend([m('2026-08-01', 185), m('2026-08-02', 184)])).toBeNull();
    const t = waistTrend([m('2026-08-20', 184, 35.5)])!;
    expect(t.change28).toBeNull();
    expect(t.points).toHaveLength(1);
  });
});

describe('bodyweightNear', () => {
  it('finds the nearest reading within the window', () => {
    const ms = [m('2026-08-01', 185), m('2026-08-10', 183)];
    expect(bodyweightNear(ms, '2026-08-08')).toBe(183);
    expect(bodyweightNear(ms, '2026-08-25')).toBeNull();
  });
});
