import { useMemo, useState } from 'react';
import { Sheet } from './Sheet';
import type { Category, Exercise } from '../types';
import { store, useAppState } from '../store/store';
import { newId } from '../lib/ids';
import { SUGGESTED_SUBSTITUTES } from '../data/substitutions';

const CATEGORIES: Category[] = [
  'Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Quads',
  'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full Body', 'Cardio', 'Other',
];

/** Searchable exercise picker with inline custom-exercise creation. */
export function ExercisePicker({
  title = 'CHOOSE EXERCISE',
  forExerciseId,
  onPick,
  onClose,
}: {
  title?: string;
  /** when substituting: suggested substitutes for this exercise are listed first */
  forExerciseId?: string;
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const state = useAppState();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState<Category>('Other');
  const [newEquip, setNewEquip] = useState<Exercise['equipment']>('dumbbell');
  const [newBW, setNewBW] = useState(false);

  const suggested = useMemo(() => {
    if (!forExerciseId || q.trim()) return [];
    return (SUGGESTED_SUBSTITUTES[forExerciseId] ?? [])
      .map((id) => state.exercises.find((e) => e.id === id))
      .filter((e): e is Exercise => !!e);
  }, [forExerciseId, q, state.exercises]);

  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = [...state.exercises].sort((a, b) => a.name.localeCompare(b.name));
    if (!needle) return list;
    return list.filter(
      (e) =>
        e.name.toLowerCase().includes(needle) ||
        e.category.toLowerCase().includes(needle) ||
        e.equipment.includes(needle),
    );
  }, [q, state.exercises]);

  function createExercise() {
    const ex: Exercise = {
      id: newId('exc'),
      name: newName.trim(),
      category: newCat,
      equipment: newEquip,
      bodyweight: newBW || newEquip === 'bodyweight' || undefined,
      perHand: newEquip === 'dumbbell' || undefined,
      custom: true,
    };
    store.saveExercise(ex);
    onPick(ex);
  }

  return (
    <Sheet onClose={onClose}>
      <div className="tiny faint">{title}</div>
      {!creating ? (
        <>
          <div className="mt8">
            <input
              type="search"
              placeholder="search (e.g. lat)…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
            />
          </div>
          <div style={{ maxHeight: '45dvh', overflowY: 'auto', marginTop: 8 }}>
            {suggested.length > 0 && (
              <>
                <div className="tiny faint mt8">SUGGESTED SUBSTITUTES</div>
                {suggested.map((e) => (
                  <button key={`s-${e.id}`} className="list-row" onClick={() => onPick(e)}>
                    <div style={{ flex: 1 }}>
                      <div className="cyan">{e.name}</div>
                      <div className="tiny faint">{e.category.toUpperCase()} · {e.equipment.toUpperCase()}</div>
                    </div>
                  </button>
                ))}
                <div className="tiny faint mt16">ALL EXERCISES</div>
              </>
            )}
            {results.map((e) => (
              <button key={e.id} className="list-row" onClick={() => onPick(e)}>
                <div style={{ flex: 1 }}>
                  <div>{e.name}</div>
                  <div className="tiny faint">
                    {e.category.toUpperCase()} · {e.equipment.toUpperCase()}
                    {e.custom ? ' · CUSTOM' : ''}
                  </div>
                </div>
              </button>
            ))}
            {results.length === 0 && <div className="center dim small mt16">no matches</div>}
          </div>
          <button
            className="btn btn--ghost mt16"
            style={{ width: '100%' }}
            onClick={() => {
              setCreating(true);
              setNewName(q.trim());
            }}
          >
            + CREATE CUSTOM EXERCISE
          </button>
        </>
      ) : (
        <div className="mt8">
          <input
            placeholder="exercise name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <div className="row mt8" style={{ gap: 8 }}>
            <select value={newCat} onChange={(e) => setNewCat(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <select value={newEquip} onChange={(e) => setNewEquip(e.target.value as Exercise['equipment'])}>
              {(['dumbbell', 'barbell', 'cable', 'bodyweight', 'machine', 'other'] as const).map((eq) => (
                <option key={eq} value={eq}>{eq}</option>
              ))}
            </select>
          </div>
          <button className={`chip mt8 ${newBW ? 'on' : ''}`} onClick={() => setNewBW(!newBW)}>
            BODYWEIGHT-BASED {newBW ? '✓' : ''}
          </button>
          <div className="row mt16" style={{ gap: 10 }}>
            <button className="btn btn--ghost" style={{ flex: 1 }} onClick={() => setCreating(false)}>
              BACK
            </button>
            <button
              className="btn btn--primary"
              style={{ flex: 2, minHeight: 48 }}
              disabled={!newName.trim()}
              onClick={createExercise}
            >
              CREATE
            </button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
