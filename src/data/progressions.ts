import type { Exercise } from '../types';

/**
 * Progression chains: ordered ladders of bodyweight variations for one movement pattern.
 * The exercises themselves carry `progressionId` + `level`; this file names the chains and
 * says which muscles they are for. A chain is the unit of progressive overload for bodyweight
 * training: when the rep ceiling is hit on every prescribed set, the next session moves one
 * rung up. When the top rung is reached, overload comes from added load (a loaded backpack),
 * pauses, or slower eccentrics.
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
}

export const PROGRESSIONS: Progression[] = [
  { id: 'push', name: 'PUSH-UP CHAIN', pattern: 'HORIZONTAL PUSH', muscles: 'chest · front delts · triceps', topNote: 'Add a loaded backpack, a 2-s pause at the bottom, or a deficit (hands on books).' },
  { id: 'vpush', name: 'HANDSTAND CHAIN', pattern: 'VERTICAL PUSH', muscles: 'shoulders · triceps · upper chest', topNote: 'Deficit HSPU (hands on books) or a 2-s pause at the bottom.' },
  { id: 'dip', name: 'DIP CHAIN', pattern: 'DIP', muscles: 'chest · triceps · front delts', topNote: 'Add a loaded backpack or slow the eccentric to 4 s.' },
  { id: 'pull', name: 'PULL-UP CHAIN', pattern: 'VERTICAL PULL', muscles: 'lats · upper back · biceps · grip', topNote: 'Weighted pull-ups with a loaded backpack; or start one-arm negatives.' },
  { id: 'chin', name: 'CHIN-UP CHAIN', pattern: 'VERTICAL PULL · SUPINATED', muscles: 'lats · biceps · forearms', topNote: 'Weighted chin-ups with a loaded backpack.' },
  { id: 'row', name: 'ROW CHAIN', pattern: 'HORIZONTAL PULL', muscles: 'mid-back · rear delts · biceps', topNote: 'Add a backpack on the chest, a 2-s pause, or swap to rings when you get them.' },
  { id: 'tri', name: 'TRICEPS CHAIN', pattern: 'ELBOW EXTENSION', muscles: 'triceps (long head)', topNote: 'Slow the eccentric to 4 s or add a backpack.' },
  { id: 'squat', name: 'SQUAT CHAIN', pattern: 'SINGLE-LEG SQUAT', muscles: 'quads · glutes · balance', topNote: 'Loaded backpack, or a 2-s pause at the bottom of each rep.' },
  { id: 'lunge', name: 'LUNGE CHAIN', pattern: 'SPLIT-STANCE KNEE', muscles: 'quads · glutes · adductors', topNote: 'Loaded backpack, deeper deficit, or 3-s descents.' },
  { id: 'hinge', name: 'NORDIC CHAIN', pattern: 'KNEE FLEXION / HINGE', muscles: 'hamstrings · glutes', topNote: 'Full Nordics with hands behind the head, or a backpack on the back.' },
  { id: 'glute', name: 'HIP THRUST CHAIN', pattern: 'HIP EXTENSION', muscles: 'glutes · hamstrings', topNote: 'Loaded backpack on the hips, 2-s squeeze at the top.' },
  { id: 'calf', name: 'CALF CHAIN', pattern: 'ANKLE', muscles: 'calves', topNote: 'Loaded backpack, 3-s pause at the stretch.' },
  { id: 'hangcore', name: 'HANGING CORE CHAIN', pattern: 'HIP FLEXION / ANTI-EXTENSION', muscles: 'abs · hip flexors · grip', topNote: 'Slow 4-s lowers, or ankle weights.' },
  { id: 'lsit', name: 'L-SIT CHAIN', pattern: 'COMPRESSION HOLD', muscles: 'abs · hip flexors · triceps', topNote: 'Longer holds, or move to V-sit attempts.' },
  { id: 'side', name: 'SIDE CHAIN', pattern: 'LATERAL CORE', muscles: 'obliques · adductors · QL', topNote: 'Add hip dips or a slow leg lift during the hold.' },
  { id: 'dragon', name: 'DRAGON FLAG CHAIN', pattern: 'ANTERIOR CORE', muscles: 'abs · hip flexors · lats', topNote: 'Slow 5-s lowers, or single-leg dragon flags.' },
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
