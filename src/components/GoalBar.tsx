import type { GoalAttainment } from '../lib/flex';

/** "BOXING ███░ 3 / 4 · MINIMUM 2 ✓" — a neutral progress row. Optional goals are dim and never judged. */
export function GoalBar({ g }: { g: GoalAttainment }) {
  const total = Math.max(g.target, g.count, 1);
  const cells = Array.from({ length: total }, (_, i) => i < g.count);
  const cls = g.optional ? 'goalbar goalbar--optional' : g.targetMet ? 'goalbar goalbar--target' : g.minMet ? 'goalbar goalbar--min' : 'goalbar';
  return (
    <div className={cls} data-testid={`goal-${g.goal.kind === 'workout' ? 'optional' : g.goal.kind}`}>
      <div className="spread">
        <span className="goalbar__label">{g.label}</span>
        <span className="goalbar__count">
          {g.count} <span className="faint">/ {g.target}</span>
        </span>
      </div>
      <div className="goalbar__cells" aria-hidden>
        {cells.map((on, i) => (
          <span key={i} className={on ? 'on' : ''} />
        ))}
      </div>
      <div className="spread tiny mt8">
        {g.optional ? (
          <span className="faint">OPTIONAL · never affects adherence</span>
        ) : (
          <span className={g.minMet ? 'green' : 'faint'}>
            MINIMUM {g.minimum} {g.minMet ? '✓' : ''}
          </span>
        )}
        {!g.optional && g.targetMet && <span className="cyan">TARGET ✓</span>}
        {g.max != null && !g.optional && g.count >= g.max && !g.targetMet && <span className="faint">AT MAX</span>}
      </div>
    </div>
  );
}
