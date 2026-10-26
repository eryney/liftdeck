import { describe, expect, it } from 'vitest';
import { applyCalibration, DEFAULT_CALIBRATION, startingRungs } from '../src/lib/calibrate';
import { SEED_TEMPLATES, TPL_LA, TPL_LB, TPL_UA, TPL_UB } from '../src/data/seedPlan';
import { EXERCISE_LIBRARY } from '../src/data/exercises';

const slotIds = (tplId: string, templates = SEED_TEMPLATES) => templates.find((t) => t.id === tplId)!.exercises.map((te) => te.exerciseId);

describe('calibration', () => {
  it('the default answers leave the shipped program untouched', () => {
    expect(startingRungs(DEFAULT_CALIBRATION)).toEqual({ 'chair-dip': 'bench-dip-elevated' });
    const out = applyCalibration(SEED_TEMPLATES, { ...DEFAULT_CALIBRATION, push: '5-14' });
    expect(slotIds(TPL_UA, out)).toEqual(slotIds(TPL_UA));
  });

  it('a true beginner starts on negatives, inclines, bench dips and two-leg squats', () => {
    const out = applyCalibration(SEED_TEMPLATES, { pull: '0', push: '0-4', squat: 'squats', bands: true });
    expect(slotIds(TPL_UA, out)).toContain('negative-pull-up');
    expect(slotIds(TPL_UA, out)).toContain('incline-push-up');
    expect(slotIds(TPL_UB, out)).toContain('negative-chin-up');
    expect(slotIds(TPL_UB, out)).toContain('bench-dip');
    expect(slotIds(TPL_UB, out)).toContain('incline-push-up'); // second weekly push-up exposure moves too
    expect(slotIds(TPL_LA, out)).toContain('bodyweight-squat');
  });

  it('bands only matter in the 1–4 pull-up band', () => {
    expect(startingRungs({ ...DEFAULT_CALIBRATION, pull: '1-4', bands: true })['pull-up']).toBe('band-assisted-pull-up');
    expect(startingRungs({ ...DEFAULT_CALIBRATION, pull: '1-4', bands: false })['pull-up']).toBe('negative-pull-up');
    expect(startingRungs({ ...DEFAULT_CALIBRATION, pull: '0', bands: true })['pull-up']).toBe('negative-pull-up');
  });

  it('an advanced start skips ahead on every relevant chain', () => {
    const out = applyCalibration(SEED_TEMPLATES, { pull: '12+', push: '30+', squat: 'pistol', bands: false });
    expect(slotIds(TPL_UA, out)).toContain('archer-pull-up');
    expect(slotIds(TPL_UA, out)).toContain('pseudo-planche-push-up');
    expect(slotIds(TPL_UA, out)).toContain('elevated-pike-push-up');
    expect(slotIds(TPL_UB, out)).toContain('archer-chin-up');
    expect(slotIds(TPL_LA, out)).toContain('pistol-squat');
    expect(slotIds(TPL_LB, out)).toContain('skater-squat');
  });

  it('every calibrated exercise exists and stays inside the slot chain', () => {
    const byId = new Map(EXERCISE_LIBRARY.map((e) => [e.id, e]));
    for (const pull of ['0', '1-4', '5-11', '12+'] as const) {
      for (const push of ['0-4', '5-14', '15-29', '30+'] as const) {
        for (const squat of ['squats', 'split', 'pistol'] as const) {
          for (const bands of [true, false]) {
            const map = startingRungs({ pull, push, squat, bands });
            for (const [from, to] of Object.entries(map)) {
              expect(byId.has(to), `${to} exists`).toBe(true);
              expect(byId.get(to)!.progressionId, `${from} → ${to} same chain`).toBe(byId.get(from)!.progressionId);
            }
          }
        }
      }
    }
  });
});
