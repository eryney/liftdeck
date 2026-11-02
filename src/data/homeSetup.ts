import type { ExerciseSession, TemplateExercise, WorkoutSession, WorkoutTemplate } from '../types';
import { EXERCISE_LIBRARY } from './exercises';
import { newId } from '../lib/ids';

export const HOME_SETUP_MARKER = 'upright-bar-floor-core-v1';

/** Replace the old default's suspended core and gymnastic skills with bands and floor work. */
export function homeReplacement(exerciseId: string, templateId?: string): { exerciseId: string; repMin: number; repMax: number } | null {
  const chain = EXERCISE_LIBRARY.find((e) => e.id === exerciseId)?.progressionId;
  if (chain === 'frontlever') return { exerciseId: 'band-pull-apart', repMin: 12, repMax: 20 };
  if (chain === 'planche') return { exerciseId: 'band-curl', repMin: 8, repMax: 15 };
  if (chain === 'hangcore') return { exerciseId: 'dead-bug', repMin: 8, repMax: 12 };
  if (chain === 'dragon') return { exerciseId: 'floor-reverse-crunch', repMin: 8, repMax: 12 };
  if (chain === 'muscleup') return { exerciseId: 'pull-up', repMin: 5, repMax: 8 };
  if (exerciseId === 'wall-handstand-hold' && templateId === 'tpl_bs_flow') {
    return { exerciseId: 'forearm-plank', repMin: 15, repMax: 30 };
  }
  if (chain === 'vpush' || exerciseId === 'wall-handstand-hold') {
    return { exerciseId: 'band-shoulder-press', repMin: 8, repMax: 15 };
  }
  return null;
}

export function adaptHomeSlot(slot: TemplateExercise, templateId?: string): TemplateExercise {
  const replacement = homeReplacement(slot.exerciseId, templateId);
  return replacement ? { ...slot, ...replacement, increment: 0, startWeight: 0 } : slot;
}

export function adaptHomeTemplate(template: WorkoutTemplate): WorkoutTemplate {
  return { ...template, exercises: template.exercises.map((slot) => adaptHomeSlot(slot, template.id)) };
}

/** Preserve logged sets under their original names; replace only the work still to do. */
export function adaptActiveHomeSession(session: WorkoutSession): WorkoutSession {
  if (session.status !== 'active') return session;
  return {
    ...session,
    exercises: session.exercises.flatMap((old): ExerciseSession[] => {
      const replacement = homeReplacement(old.exerciseId, session.templateId);
      if (!replacement || old.skippedReason) return [old];
      const ex = EXERCISE_LIBRARY.find((e) => e.id === replacement.exerciseId)!;
      const logged = old.sets.slice(0, old.targetSets).filter((set) => set.reps != null).length;
      const hasLogs = old.sets.some((set) => set.reps != null);
      const remaining = Math.max(0, old.targetSets - logged);
      const preserved = hasLogs ? [{ ...old, skippedReason: `Remaining work replaced for your equipment setup. Logged sets are kept as ${old.name}.` }] : [];
      if (remaining === 0) return preserved;
      const next: ExerciseSession = {
        id: hasLogs ? newId('es') : old.id,
        exerciseId: ex.id, name: ex.name, bodyweight: true,
        perSide: ex.perSide, timed: ex.timed, bandResistance: ex.bandResistance, repsOnly: ex.repsOnly,
        targetSets: remaining, repMin: replacement.repMin, repMax: replacement.repMax,
        restSec: old.restSec, increment: 0, suggestedWeight: 0, weight: 0,
        sets: Array.from({ length: remaining }, () => ({ reps: null, weight: 0 })),
        targetReps: Array.from({ length: remaining }, () => replacement.repMin),
        slotId: old.slotId, pairGroup: old.pairGroup, cue: ex.cue, gear: ex.gear,
        substitutedFor: old.name,
      };
      return [...preserved, next];
    }),
  };
}
