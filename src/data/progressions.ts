import type { Exercise } from '../types';

/**
 * Progression chains: ordered ladders of bodyweight variations for one movement pattern.
 * The exercises carry `progressionId` + `level`; this file names the chains and says what they
 * train. A chain is the unit of progressive overload for bodyweight training: when the rep ceiling
 * is hit on every prescribed set, the next session moves one rung up. At the top rung, overload
 * comes from added load (a loaded backpack), pauses, or slower eccentrics.
 */
export interface Progression {
  id: string;
  name: string;
  /** movement pattern label shown in the UI */
  pattern: string;
  /** what the chain trains, for the overview */
  muscles: string;
  /** what to do once the last rung is at the rep ceiling */
  topNote: string;
  /** chains that need a bar you can get above (not a doorway bar) */
  needsClearance?: boolean;
}

export const PROGRESSIONS: Progression[] = [
  { id: 'pull', name: 'Pull-up', pattern: 'Vertical pull', muscles: 'lats · upper back · biceps · grip', topNote: 'Add load with a backpack, or chase reps on the one-arm pull-up.' },
  { id: 'chin', name: 'Chin-up', pattern: 'Vertical pull · underhand', muscles: 'lats · biceps · forearms', topNote: 'Add load with a backpack.' },
  { id: 'muscleup', name: 'Muscle-up', pattern: 'Explosive pull', muscles: 'lats · upper back · triceps', topNote: 'Chase clean reps, then add load.', needsClearance: true },
  { id: 'row', name: 'Row', pattern: 'Horizontal pull', muscles: 'mid-back · rear delts · biceps', topNote: 'Add a backpack on the chest, a 2-s pause, or swap to rings when you get them.' },
  { id: 'frontlever', name: 'Front lever', pattern: 'Straight-arm pull · hold', muscles: 'lats · core · scapular depressors', topNote: 'Longer holds, then front lever raises and pulls.' },
  { id: 'planche', name: 'Planche', pattern: 'Straight-arm push · hold', muscles: 'front delts · biceps tendon · core', topNote: 'Longer holds, then planche push-ups.' },
  { id: 'push', name: 'Push-up', pattern: 'Horizontal push', muscles: 'chest · front delts · triceps', topNote: 'Add a loaded backpack, a 2-s pause at the bottom, or a deficit (hands on books).' },
  { id: 'vpush', name: 'Handstand push-up', pattern: 'Vertical push', muscles: 'shoulders · triceps · upper chest', topNote: 'Deeper deficit, or a 2-s pause at the bottom.' },
  { id: 'dip', name: 'Dip', pattern: 'Dip', muscles: 'chest · triceps · front delts', topNote: 'Add a loaded backpack or slow the eccentric to 4 s.' },
  { id: 'squat', name: 'Squat', pattern: 'Single-leg squat', muscles: 'quads · glutes · balance', topNote: 'Loaded backpack, or a 2-s pause at the bottom of each rep.' },
  { id: 'lunge', name: 'Lunge', pattern: 'Split-stance knee', muscles: 'quads · glutes · adductors', topNote: 'Loaded backpack, deeper deficit, or 3-s descents.' },
  { id: 'hinge', name: 'Nordic', pattern: 'Knee flexion', muscles: 'hamstrings · glutes', topNote: 'A backpack on the back, or slower descents.' },
  { id: 'glute', name: 'Hip thrust', pattern: 'Hip extension', muscles: 'glutes · hamstrings', topNote: 'Loaded backpack on the hips, 2-s squeeze at the top.' },
  { id: 'calf', name: 'Calf', pattern: 'Ankle', muscles: 'calves', topNote: 'Loaded backpack, 3-s pause at the stretch.' },
  { id: 'hangcore', name: 'Hanging core', pattern: 'Hip flexion', muscles: 'abs · hip flexors · grip', topNote: 'Slow 4-s lowers, or ankle weights.' },
  { id: 'lsit', name: 'L-sit', pattern: 'Compression · hold', muscles: 'abs · hip flexors · triceps', topNote: 'Longer holds, then V-sit presses.' },
  { id: 'side', name: 'Side plank', pattern: 'Lateral core · hold', muscles: 'obliques · adductors', topNote: 'Add hip dips or a slow leg lift during the hold.' },
  { id: 'dragon', name: 'Dragon flag', pattern: 'Anterior core', muscles: 'abs · hip flexors · lats', topNote: 'Slow 5-s lowers, or single-leg dragon flags.' },
];

export function progressionById(id: string | undefined): Progression | undefined {
  return id ? PROGRESSIONS.find((p) => p.id === id) : undefined;
}

/** Ordered rungs of a chain from any exercise list (library + custom). */
export function chainLevels(exercises: Exercise[], progressionId: string): Exercise[] {
  return exercises.filter((e) => e.progressionId === progressionId).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
}

/** The chain an exercise belongs to, as ordered rungs; empty when it is not in a chain. */
export function chainFor(exercises: Exercise[], exerciseId: string): Exercise[] {
  const ex = exercises.find((e) => e.id === exerciseId);
  if (!ex?.progressionId) return [];
  return chainLevels(exercises, ex.progressionId);
}
