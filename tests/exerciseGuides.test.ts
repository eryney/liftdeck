import { describe, expect, it } from 'vitest';
import { EXERCISE_LIBRARY } from '../src/data/exercises';
import { exerciseGuide } from '../src/data/exerciseGuides';

describe('exercise reference diagrams', () => {
  it('covers every bundled exercise with two drawable frames and named muscle groups', () => {
    for (const exercise of EXERCISE_LIBRARY) {
      const guide = exerciseGuide(exercise.id);
      expect(guide, exercise.id).not.toBeNull();
      expect(guide!.frames, exercise.id).toHaveLength(2);
      expect(guide!.main.length, exercise.id).toBeGreaterThan(0);
      expect(guide!.detail, exercise.id).toBe(exercise.cue);
      for (const frame of guide!.frames) {
        const pose = frame.pose;
        const points = [pose.head,pose.shoulder,pose.hip,...pose.arms.flat(),...pose.legs.flat(),...frame.props.flatMap((p) => p.points)];
        for (const [x,y] of points) { expect(Number.isFinite(x) && Number.isFinite(y), exercise.id).toBe(true); expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(200); expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(166); }
      }
    }
  });
  it('distinguishes equipment, one-arm variations, and the direction of negative reps', () => {
    expect(exerciseGuide('one-arm-pull-up')!.frames).not.toEqual(exerciseGuide('pull-up')!.frames);
    expect(exerciseGuide('bulgarian-split-squat-bw')!.frames[1].props.length).toBeGreaterThan(0);
    expect(exerciseGuide('split-squat')!.frames[1].props).toHaveLength(0);
    expect(exerciseGuide('negative-pull-up')!.frames[0].pose).toEqual(exerciseGuide('pull-up')!.frames[1].pose);
    expect(exerciseGuide('band-row-paused')!.detail).toContain('2 s');
    expect(exerciseGuide('band-row-slow')!.detail).toContain('4 s');
    expect(exerciseGuide('ex_custom')).toBeNull();
  });
});
