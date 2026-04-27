import type { BreakdownRow } from "@/lib/analytics/queries";

interface Props {
  title: string;
  rows: BreakdownRow[];
}

export default function BreakdownBars({ title, rows }: Props) {
  const total = rows.reduce((acc, r) => acc + r.count, 0);
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        {title}
      </div>
      {total === 0 ? (
        <div className="text-sm text-slate-400 py-4 text-center">No data yet.</div>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const pct = total > 0 ? (r.count / total) * 100 : 0;
            return (
              <li key={(r.label ?? "_unknown") + r.count}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-700 capitalize truncate">
                    {r.label ?? "unknown"}
                  </span>
                  <span className="tabular-nums text-slate-500 text-xs">
                    {r.count.toLocaleString()} · {pct.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full bg-slate-500/70"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
