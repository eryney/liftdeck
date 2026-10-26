export interface WeightCtx {
  weight: number;
  bodyweight?: boolean;
}

/** Short load label: "BW" or "BW+10" */
export function fmtWeightShort(w: WeightCtx): string {
  return w.weight > 0 ? `BW+${trim(w.weight)}` : 'BW';
}

/** Full label with unit: "Bodyweight" or "Bodyweight + 10 lb" */
export function fmtWeightFull(w: WeightCtx, unit: string): string {
  return w.weight > 0 ? `Bodyweight + ${trim(w.weight)} ${unit}` : 'Bodyweight';
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
