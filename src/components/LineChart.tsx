import { formatShort } from '../lib/dates';

export interface ChartSeries {
  points: { date: string; value: number }[];
  color: string;
  /** draw dots on each point */
  dots?: boolean;
  dashed?: boolean;
}

/** Minimal retro SVG line chart. Dates on x, values on y. */
export function LineChart({
  series,
  height = 180,
  unit = '',
}: {
  series: ChartSeries[];
  height?: number;
  unit?: string;
}) {
  const all = series.flatMap((s) => s.points);
  if (all.length === 0) {
    return <div className="chart-wrap center dim small" style={{ padding: 24 }}>NO DATA YET</div>;
  }
  const width = 340;
  const padL = 40;
  const padR = 10;
  const padT = 12;
  const padB = 24;

  const dates = [...new Set(all.map((p) => p.date))].sort();
  const t0 = new Date(dates[0] + 'T00:00:00').getTime();
  const t1 = new Date(dates[dates.length - 1] + 'T00:00:00').getTime();
  const span = Math.max(t1 - t0, 86400000);
  let vMin = Math.min(...all.map((p) => p.value));
  let vMax = Math.max(...all.map((p) => p.value));
  if (vMin === vMax) {
    vMin -= 5;
    vMax += 5;
  }
  const vPad = (vMax - vMin) * 0.12;
  vMin -= vPad;
  vMax += vPad;

  const x = (date: string) =>
    padL + ((new Date(date + 'T00:00:00').getTime() - t0) / span) * (width - padL - padR);
  const y = (v: number) => padT + (1 - (v - vMin) / (vMax - vMin)) * (height - padT - padB);

  const yTicks = [vMin + vPad, (vMin + vMax) / 2, vMax - vPad].map((v) => Math.round(v * 10) / 10);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', display: 'block' }} role="img">
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={padL} x2={width - padR} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeWidth="1" />
            <text x={padL - 6} y={y(v) + 3} textAnchor="end" fontSize="9" fill="var(--faint)" fontFamily="var(--mono)">
              {v}
            </text>
          </g>
        ))}
        {series.map((s, si) => {
          const pts = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1));
          const d = pts.map((pt, i) => `${i === 0 ? 'M' : 'L'}${x(pt.date).toFixed(1)},${y(pt.value).toFixed(1)}`).join(' ');
          return (
            <g key={si}>
              {pts.length > 1 && (
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth="2"
                  strokeDasharray={s.dashed ? '4 4' : undefined}
                  style={{ filter: `drop-shadow(0 0 3px ${s.color})` }}
                />
              )}
              {s.dots &&
                pts.map((pt, i) => (
                  <circle key={i} cx={x(pt.date)} cy={y(pt.value)} r="3" fill={s.color} />
                ))}
            </g>
          );
        })}
        <text x={padL} y={height - 6} fontSize="9" fill="var(--faint)" fontFamily="var(--mono)">
          {formatShort(dates[0])}
        </text>
        <text x={width - padR} y={height - 6} textAnchor="end" fontSize="9" fill="var(--faint)" fontFamily="var(--mono)">
          {formatShort(dates[dates.length - 1])}
        </text>
        {unit && (
          <text x={width - padR} y={padT} textAnchor="end" fontSize="9" fill="var(--faint)" fontFamily="var(--mono)">
            {unit}
          </text>
        )}
      </svg>
    </div>
  );
}
