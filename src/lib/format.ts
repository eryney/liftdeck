export interface WeightCtx {
  weight: number;
  bodyweight?: boolean;
  perHand?: boolean;
}

/** Short weight label: "45", "BW", "BW+10" */
export function fmtWeightShort(w: WeightCtx): string {
  if (w.bodyweight) return w.weight > 0 ? `BW+${trim(w.weight)}` : 'BW';
  return trim(w.weight);
}

/** Full label with unit + qualifier: "45 LB / HAND", "BW + 10 LB" */
export function fmtWeightFull(w: WeightCtx, unit: string): string {
  const u = unit.toUpperCase();
  if (w.bodyweight) return w.weight > 0 ? `BW + ${trim(w.weight)} ${u}` : 'BODYWEIGHT';
  return `${trim(w.weight)} ${u}${w.perHand ? ' / HAND' : ''}`;
}

function trim(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, '');
}

export const trimNum = trim;

/** "8" for reps, "30s" for timed holds */
export function fmtReps(reps: number, timed?: boolean): string {
  return timed ? `${reps}s` : String(reps);
}

/** "8, 8, 7" or "30s, 30s, 25s" */
export function fmtRepList(reps: (number | null)[], timed?: boolean): string {
  return reps.filter((r): r is number => r != null).map((r) => fmtReps(r, timed)).join(', ');
}

/** Range label: "8–12" or "20–40 s" */
export function fmtRange(min: number, max: number, timed?: boolean): string {
  return timed ? `${min}–${max} s` : `${min}–${max}`;
}
