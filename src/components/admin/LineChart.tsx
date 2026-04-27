import type { DailyRow } from "@/lib/analytics/queries";

interface Series {
  key: keyof Pick<DailyRow, "uploads" | "downloads" | "saves" | "resumes" | "landingViews">;
  label: string;
  color: string;
}

const SERIES: Series[] = [
  { key: "uploads",   label: "Uploads",   color: "#d97706" }, // amber-600
  { key: "downloads", label: "Downloads", color: "#059669" }, // emerald-600
  { key: "saves",     label: "Saves",     color: "#0284c7" }, // sky-600
  { key: "resumes",   label: "Resumes",   color: "#7c3aed" }, // violet-600
];

interface Props {
  data: DailyRow[];
  height?: number;
  showLandingViews?: boolean;
}

/**
 * Multi-line trend chart over the supplied date series. Pure server-rendered
 * SVG — no client JS, no chart library. Uses native <title> for hover labels.
 *
 * If `data` is shorter than expected the chart still renders sensibly; if
 * empty we render an empty-state.
 */
export default function LineChart({ data, height = 220, showLandingViews = false }: Props) {
  const series = showLandingViews
    ? [...SERIES, { key: "landingViews" as const, label: "Landing views", color: "#64748b" }]
    : SERIES;

  if (data.length === 0) {
    return (
      <div
        className="rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-sm text-slate-400"
        style={{ height }}
      >
        No data in this window yet.
      </div>
    );
  }

  // Layout
  const PAD_L = 36;
  const PAD_R = 16;
  const PAD_T = 16;
  const PAD_B = 28;
  const W = 720;
  const H = height;
  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;

  // Y scale
  let max = 0;
  for (const r of data) {
    for (const s of series) {
      const v = r[s.key] ?? 0;
      if (v > max) max = v;
    }
  }
  if (max < 1) max = 1; // avoid divide-by-zero, keep a minimal axis
  // Round max up to a "nice" number for axis labels.
  const niceMax = niceCeil(max);

  const x = (i: number) => {
    if (data.length === 1) return PAD_L + innerW / 2;
    return PAD_L + (i / (data.length - 1)) * innerW;
  };
  const y = (v: number) => PAD_T + innerH - (v / niceMax) * innerH;

  const yTicks = makeTicks(niceMax, 4);

  // X tick labels: show first / middle / last for short series, and at most ~7 ticks otherwise.
  const tickIdxs = pickXTickIndices(data.length, 7);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 text-xs">
        {series.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-0.5 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <span className="text-slate-600 font-medium">{s.label}</span>
          </div>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label="Daily totals trend"
        className="block"
      >
        {/* Y gridlines + labels */}
        {yTicks.map((t) => (
          <g key={t}>
            <line
              x1={PAD_L}
              x2={W - PAD_R}
              y1={y(t)}
              y2={y(t)}
              stroke="#e2e8f0"
              strokeDasharray={t === 0 ? "" : "3 3"}
            />
            <text
              x={PAD_L - 6}
              y={y(t)}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="#94a3b8"
            >
              {t}
            </text>
          </g>
        ))}

        {/* X tick labels */}
        {tickIdxs.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={10}
            fill="#94a3b8"
          >
            {formatDateShort(data[i]?.date)}
          </text>
        ))}

        {/* Lines */}
        {series.map((s) => {
          const path = data
            .map((r, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(r[s.key] ?? 0).toFixed(1)}`)
            .join(" ");
          return (
            <g key={s.key}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={1.75} />
              {data.map((r, i) => {
                const v = r[s.key] ?? 0;
                if (v === 0) return null;
                return (
                  <circle
                    key={`${s.key}-${i}`}
                    cx={x(i)}
                    cy={y(v)}
                    r={2}
                    fill={s.color}
                  >
                    <title>{`${s.label} on ${r.date}: ${v.toLocaleString()}`}</title>
                  </circle>
                );
              })}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/* ── helpers ─────────────────────────────────────────────────── */

function niceCeil(n: number): number {
  if (n <= 1) return 1;
  const exp = Math.floor(Math.log10(n));
  const base = Math.pow(10, exp);
  const m = n / base;
  let nice: number;
  if (m <= 1) nice = 1;
  else if (m <= 2) nice = 2;
  else if (m <= 5) nice = 5;
  else nice = 10;
  return nice * base;
}

function makeTicks(max: number, count: number): number[] {
  const step = max / count;
  const out: number[] = [];
  for (let i = 0; i <= count; i++) out.push(Math.round(step * i));
  return out;
}

function pickXTickIndices(n: number, max: number): number[] {
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const step = (n - 1) / (max - 1);
  const set = new Set<number>();
  for (let i = 0; i < max; i++) set.add(Math.round(i * step));
  return Array.from(set).sort((a, b) => a - b);
}

function formatDateShort(iso: string | undefined): string {
  if (!iso) return "";
  // 'YYYY-MM-DD' → 'MMM D'
  const d = new Date(iso + "T00:00:00Z");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
