import type { HeatmapCell } from "@/lib/analytics/queries";

interface Props {
  cells: HeatmapCell[];
  /** Visible label for the metric being shown. */
  metricLabel: string;
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * 24-column × 7-row heatmap. Pure server-rendered SVG.
 * Hour 0 (UTC midnight) is leftmost column, Mon is top row.
 */
export default function Heatmap({ cells, metricLabel }: Props) {
  let max = 0;
  for (const c of cells) if (c.count > max) max = c.count;
  const hasData = max > 0;

  const cellW = 22;
  const cellH = 22;
  const gap = 2;
  const labelW = 32;
  const headerH = 16;
  const W = labelW + 24 * (cellW + gap);
  const H = headerH + 7 * (cellH + gap);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="flex items-center justify-between mb-3 text-xs text-slate-500">
        <span>
          {metricLabel} by hour (UTC) and day of week
        </span>
        {hasData && (
          <span className="tabular-nums">
            max {max.toLocaleString()}
          </span>
        )}
      </div>

      {!hasData ? (
        <div className="flex items-center justify-center text-sm text-slate-400 py-12">
          No data yet.
        </div>
      ) : (
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          role="img"
          aria-label={`${metricLabel} heatmap`}
          className="block"
        >
          {/* Hour header row */}
          {Array.from({ length: 24 }, (_, h) => (
            <text
              key={`hh-${h}`}
              x={labelW + h * (cellW + gap) + cellW / 2}
              y={headerH - 4}
              textAnchor="middle"
              fontSize={9}
              fill="#94a3b8"
            >
              {h % 3 === 0 ? h : ""}
            </text>
          ))}

          {/* DOW labels + cells */}
          {DOW_LABELS.map((label, dow) => (
            <g key={`dow-${dow}`}>
              <text
                x={labelW - 4}
                y={headerH + dow * (cellH + gap) + cellH / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize={10}
                fill="#64748b"
              >
                {label}
              </text>
              {Array.from({ length: 24 }, (_, hour) => {
                const cell =
                  cells.find((c) => c.dow === dow && c.hour === hour) ??
                  { dow, hour, count: 0 };
                const intensity = max > 0 ? cell.count / max : 0;
                const fill = intensity === 0
                  ? "#f1f5f9" // slate-100
                  : interpolateAmber(intensity);
                return (
                  <rect
                    key={`c-${dow}-${hour}`}
                    x={labelW + hour * (cellW + gap)}
                    y={headerH + dow * (cellH + gap)}
                    width={cellW}
                    height={cellH}
                    rx={3}
                    ry={3}
                    fill={fill}
                  >
                    <title>{`${label} ${pad2(hour)}:00 — ${cell.count} ${metricLabel}`}</title>
                  </rect>
                );
              })}
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

/** 0..1 -> CSS color (white-ish at 0, amber-700 at 1). */
function interpolateAmber(t: number): string {
  // base: slate-100 (#f1f5f9)
  // peak: amber-600 (#d97706)
  const c0 = [0xf1, 0xf5, 0xf9];
  const c1 = [0xd9, 0x77, 0x06];
  const k = Math.max(0.05, Math.min(1, t)); // floor so any nonzero is visible
  const r = Math.round(c0[0] + (c1[0] - c0[0]) * k);
  const g = Math.round(c0[1] + (c1[1] - c0[1]) * k);
  const b = Math.round(c0[2] + (c1[2] - c0[2]) * k);
  return `rgb(${r}, ${g}, ${b})`;
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
