import { useMemo, useState } from 'react';
import { store, useAppState } from '../store/store';
import type { Exercise } from '../types';
import { Sheet } from './Sheet';
import { SUGGESTED_SUBSTITUTES } from '../data/substitutions';
import { PROGRESSIONS, progressionById } from '../data/progressions';
import { newId } from '../lib/ids';

const CATEGORIES: Exercise['category'][] = ['Back', 'Chest', 'Shoulders', 'Biceps', 'Triceps', 'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Core', 'Full Body', 'Other'];

/** Everything in the library is bodyweight; only band moves need extra gear. Retired rows never show. */
function pickable(e: Exercise): boolean {
  return e.equipment === 'bodyweight' || e.equipment === 'band' || !!e.custom;
}

export function ExercisePicker({
  title = 'Pick an exercise',
  forExerciseId,
  onPick,
  onClose,
}: {
  title?: string;
  /** when swapping, suggested substitutes for this exercise are shown first */
  forExerciseId?: string;
  onPick: (ex: Exercise) => void;
  onClose: () => void;
}) {
  const state = useAppState();
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState<Exercise['category']>('Other');
  const [newTimed, setNewTimed] = useState(false);
  const [newPerSide, setNewPerSide] = useState(false);

  const all = useMemo(() => state.exercises.filter(pickable), [state.exercises]);
  const suggested = useMemo(() => {
    if (!forExerciseId) return [];
    const ids = SUGGESTED_SUBSTITUTES[forExerciseId] ?? [];
    return ids.map((id) => all.find((e) => e.id === id)).filter((e): e is Exercise => !!e && e.id !== forExerciseId);
  }, [forExerciseId, all]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return all.filter((e) => !needle || e.name.toLowerCase().includes(needle) || e.category.toLowerCase().includes(needle) || (progressionById(e.progressionId)?.name.toLowerCase().includes(needle) ?? false));
  }, [all, q]);

  // group by chain (in library order), then fixed accessories by category
  const groups = useMemo(() => {
    const out: { label: string; items: Exercise[] }[] = [];
    for (const p of PROGRESSIONS) {
      const items = filtered.filter((e) => e.progressionId === p.id).sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
      if (items.length) out.push({ label: `${p.name} chain · ${p.pattern.toLowerCase()}`, items });
    }
    for (const c of CATEGORIES) {
      const items = filtered.filter((e) => !e.progressionId && e.category === c);
      if (items.length) out.push({ label: `${c} · no chain`, items });
    }
    return out;
  }, [filtered]);

  function create() {
    const name = newName.trim();
    if (!name) return;
    const ex: Exercise = {
      id: newId('ex'),
      name,
      category: newCat,
      equipment: 'bodyweight',
      bodyweight: true,
      custom: true,
      ...(newTimed ? { timed: true } : {}),
      ...(newPerSide ? { perSide: true } : {}),
    };
    store.saveExercise(ex);
    onPick(ex);
  }

  return (
    <Sheet onClose={onClose} title={title}>
      {!creating ? (
        <>
          <input className="mt12" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="search exercises" />
          {suggested.length > 0 && !q && (
            <div className="mt12">
              <div className="eyebrow">Same pattern, different gear</div>
              {suggested.map((e) => (
                <Row key={e.id} e={e} onPick={onPick} />
              ))}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.label} className="mt16">
              <div className="eyebrow">{g.label}</div>
              {g.items.map((e) => (
                <Row key={e.id} e={e} onPick={onPick} />
              ))}
            </div>
          ))}
          <button className="btn btn--ghost btn--block mt16" onClick={() => setCreating(true)}>
            + New custom exercise
          </button>
        </>
      ) : (
        <div className="mt12">
          <input autoFocus placeholder="Exercise name" value={newName} onChange={(e) => setNewName(e.target.value)} aria-label="exercise name" />
          <select className="mt8" value={newCat} onChange={(e) => setNewCat(e.target.value as Exercise['category'])} aria-label="muscle group">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <button className={`option ${newTimed ? 'on' : ''}`} onClick={() => setNewTimed(!newTimed)}>
            <span className="grow">Timed hold (log seconds, not reps)</span>
            <span className={`toggle ${newTimed ? 'on' : ''}`}><i /></span>
          </button>
          <button className={`option ${newPerSide ? 'on' : ''}`} onClick={() => setNewPerSide(!newPerSide)}>
            <span className="grow">One side at a time</span>
            <span className={`toggle ${newPerSide ? 'on' : ''}`}><i /></span>
          </button>
          <div className="faint tiny mt8">Custom exercises have no chain: they progress by reps, then by added load.</div>
          <div className="row mt16">
            <button className="btn btn--ghost grow" onClick={() => setCreating(false)}>Back</button>
            <button className="btn btn--primary" style={{ flex: 2, minHeight: 50 }} disabled={!newName.trim()} onClick={create}>Create</button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function Row({ e, onPick }: { e: Exercise; onPick: (ex: Exercise) => void }) {
  return (
    <button className="list-row" onClick={() => onPick(e)}>
      <span className="grow">
        <span>{e.name}</span>
        <span className="faint tiny" style={{ display: 'block' }}>
          {e.progressionId ? `rung ${(e.level ?? 0) + 1}` : e.category}
          {e.timed ? ' · hold' : ''}
          {e.perSide ? ' · per side' : ''}
          {e.gear ? ` · ${e.gear}` : ''}
        </span>
      </span>
      {e.equipment === 'band' && <span className="pill">band</span>}
      {e.custom && <span className="pill pill--accent">custom</span>}
    </button>
  );
}
