import { describe, expect, it } from 'vitest';
import type { ExerciseSession, WorkoutSession } from '../src/types';
import { EXERCISE_LIBRARY } from '../src/data/exercises';
import { SEED_TEMPLATES } from '../src/data/seedPlan';
import { chainFor } from '../src/data/progressions';
import { adaptActiveHomeSession, adaptHomeTemplate, homeReplacement } from '../src/data/homeSetup';
import { applyCalibration } from '../src/lib/calibrate';

function oldSession(logged = 0): WorkoutSession {
  const exercise: ExerciseSession = {
    id: 'old-lever', exerciseId: 'advanced-tuck-front-lever', name: 'Advanced tuck front lever',
    timed: true, progressionId: 'frontlever', level: 1, levelCount: 5,
    targetSets: 3, repMin: 10, repMax: 20, restSec: 60, increment: 5, suggestedWeight: 0, weight: 0,
    targetReps: [10, 10, 10], slotId: 'original-slot', pairGroup: 'original-pair',
    sets: Array.from({ length: 3 }, (_, i) => ({ reps: i < logged ? 12 : null, weight: 0 })),
  };
  return { id: 'active', name: 'Upper A', templateId: 'tpl_bs_upper_a', status: 'active', date: '2026-11-02', startedAt: 1, exercises: [exercise] };
}

describe('upright bar setup', () => {
  it('keeps suspended core and inverted skills out of every automatic path, including advanced calibration', () => {
    const advanced = applyCalibration(SEED_TEMPLATES, { pull: '12+', push: '30+', squat: 'pistol', bands: true });
    for (const templates of [SEED_TEMPLATES, advanced]) {
      for (const template of templates) {
        for (const slot of template.exercises) {
          const rungs = slot.lockVariation ? [] : chainFor(EXERCISE_LIBRARY, slot.exerciseId);
          for (const id of [slot.exerciseId, ...rungs.map((e) => e.id)]) {
            expect(homeReplacement(id, template.id), `${template.name}: ${id}`).toBeNull();
          }
        }
      }
    }
  });

  it('maps every old skill rung, preserves slot programming, and gives floor core no skill chain', () => {
    for (const ex of EXERCISE_LIBRARY.filter((e) => ['frontlever', 'hangcore', 'vpush', 'planche', 'dragon', 'muscleup'].includes(e.progressionId ?? ''))) {
      const template = { ...SEED_TEMPLATES[0], exercises: [{ ...SEED_TEMPLATES[0].exercises[0], id: 'keep-slot', exerciseId: ex.id, sets: 2, restSec: 42 }] };
      const adapted = adaptHomeTemplate(template);
      expect(adapted.exercises[0]).toMatchObject({ id: 'keep-slot', sets: 2, restSec: 42, startWeight: 0 });
      expect(homeReplacement(adapted.exercises[0].exerciseId)).toBeNull();
    }
    for (const id of ['dead-bug', 'floor-reverse-crunch', 'forearm-plank']) {
      expect(chainFor(EXERCISE_LIBRARY, id)).toEqual([]);
      expect(EXERCISE_LIBRARY.find((e) => e.id === id)?.repsOnly).toBe(true);
    }
  });

  it('replaces an unstarted active skill without losing its slot or pair', () => {
    const adapted = adaptActiveHomeSession(oldSession());
    expect(adapted.exercises).toHaveLength(1);
    expect(adapted.exercises[0]).toMatchObject({ id: 'old-lever', exerciseId: 'band-pull-apart', targetSets: 3, targetReps: [12, 12, 12], slotId: 'original-slot', pairGroup: 'original-pair' });
    expect(adapted.exercises[0].timed).toBeUndefined();
    expect(adapted.exercises[0].progressionId).toBeUndefined();
  });

  it('preserves partial logs under their original name and replaces only remaining sets, once', () => {
    const original = oldSession(1);
    const adapted = adaptActiveHomeSession(original);
    expect(adapted.exercises).toHaveLength(2);
    expect(adapted.exercises[0].sets).toEqual(original.exercises[0].sets);
    expect(adapted.exercises[0].exerciseId).toBe('advanced-tuck-front-lever');
    expect(adapted.exercises[0].skippedReason).toBeTruthy();
    expect(adapted.exercises[1]).toMatchObject({ exerciseId: 'band-pull-apart', targetSets: 2, targetReps: [12, 12] });
    expect(adaptActiveHomeSession(adapted)).toEqual(adapted);
  });

  it('leaves completed history untouched and adds no extra work when a skill is already finished', () => {
    const completed = { ...oldSession(3), status: 'completed' as const };
    expect(adaptActiveHomeSession(completed)).toBe(completed);
    const adapted = adaptActiveHomeSession(oldSession(3));
    expect(adapted.exercises).toHaveLength(1);
    expect(adapted.exercises[0].skippedReason).toBeTruthy();
  });
});
