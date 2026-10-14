import type { ExerciseSession } from '../types';

export interface SlotLabel {
  /** "A1", "A2", "B1" … for paired slots; "3" … for straight sets (numbered by position) */
  tag: string;
  /** letter shared by the pair, null for straight sets */
  group: string | null;
  /** 0-based position within its pair */
  pos: number;
  /** how many exercises share the pair */
  size: number;
}

/**
 * Human labels for a session's slots. Pairs get a letter (A, B, C …) in order of appearance and a
 * position (A1 ⇄ A2). Straight sets are labelled by their slot number so nothing reads as a pair.
 */
export function slotLabels(exercises: Pick<ExerciseSession, 'pairGroup'>[]): SlotLabel[] {
  const letters = new Map<string, string>();
  const sizes = new Map<string, number>();
  for (const e of exercises) if (e.pairGroup) sizes.set(e.pairGroup, (sizes.get(e.pairGroup) ?? 0) + 1);
  const seen = new Map<string, number>();
  return exercises.map((e, i) => {
    if (!e.pairGroup) return { tag: String(i + 1), group: null, pos: 0, size: 1 };
    if (!letters.has(e.pairGroup)) letters.set(e.pairGroup, String.fromCharCode(65 + letters.size));
    const letter = letters.get(e.pairGroup) as string;
    const pos = seen.get(e.pairGroup) ?? 0;
    seen.set(e.pairGroup, pos + 1);
    return { tag: `${letter}${pos + 1}`, group: letter, pos, size: sizes.get(e.pairGroup) ?? 1 };
  });
}

export function fmtRest(sec: number): string {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}
