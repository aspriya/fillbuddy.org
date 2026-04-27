import type { FunnelStats } from "@/lib/analytics/queries";

interface Props {
  stats: FunnelStats;
  windowLabel: string;
}

export default function FunnelCard({ stats, windowLabel }: Props) {
  const { sessionsWithUpload, sessionsCompleted, sessionsSaved, conversionPct, savePct } = stats;
  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Conversion funnel · {windowLabel}
      </div>

      {sessionsWithUpload === 0 ? (
        <div className="text-sm text-slate-400 py-4 text-center">
          No upload sessions yet.
        </div>
      ) : (
        <div className="space-y-3">
          <FunnelRow
            label="Uploaded a PDF"
            value={sessionsWithUpload}
            base={sessionsWithUpload}
            tone="amber"
          />
          <FunnelRow
            label="Then downloaded"
            value={sessionsCompleted}
            base={sessionsWithUpload}
            tone="emerald"
          />
          <FunnelRow
            label="Or saved progress"
            value={sessionsSaved}
            base={sessionsWithUpload}
            tone="sky"
          />

          <div className="pt-2 mt-2 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs">
            <div className="flex flex-col">
              <span className="text-slate-500">Download rate</span>
              <span className="text-base font-bold text-emerald-600 tabular-nums">
                {conversionPct == null ? "—" : `${conversionPct}%`}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-slate-500">Save rate</span>
              <span className="text-base font-bold text-sky-600 tabular-nums">
                {savePct == null ? "—" : `${savePct}%`}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FunnelRow({
  label,
  value,
  base,
  tone,
}: {
  label: string;
  value: number;
  base: number;
  tone: "amber" | "emerald" | "sky";
}) {
  const pct = base > 0 ? (value / base) * 100 : 0;
  const bg = tone === "amber" ? "bg-amber-500" : tone === "emerald" ? "bg-emerald-500" : "bg-sky-500";
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">{label}</span>
        <span className="tabular-nums text-slate-500 text-xs">
          {value.toLocaleString()} · {pct.toFixed(0)}%
        </span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full ${bg}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
