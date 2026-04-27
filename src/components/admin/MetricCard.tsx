interface Props {
  label: string;
  value: number | string;
  sub?: string;
  accent?: "amber" | "emerald" | "sky" | "violet" | "slate";
}

const ACCENTS: Record<NonNullable<Props["accent"]>, string> = {
  amber: "from-amber-500/10 to-amber-500/0 text-amber-600",
  emerald: "from-emerald-500/10 to-emerald-500/0 text-emerald-600",
  sky: "from-sky-500/10 to-sky-500/0 text-sky-600",
  violet: "from-violet-500/10 to-violet-500/0 text-violet-600",
  slate: "from-slate-500/10 to-slate-500/0 text-slate-600",
};

export default function MetricCard({ label, value, sub, accent = "slate" }: Props) {
  const klass = ACCENTS[accent];
  return (
    <div className="relative rounded-2xl bg-white border border-slate-200 px-5 py-4 shadow-sm overflow-hidden">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${klass.split(" ").slice(0, 2).join(" ")}`}
        aria-hidden
      />
      <div className="relative">
        <div className={`text-[11px] font-semibold uppercase tracking-wider ${klass.split(" ").slice(2).join(" ")}`}>
          {label}
        </div>
        <div className="mt-1.5 text-2xl font-extrabold text-slate-900 tabular-nums">
          {typeof value === "number" ? value.toLocaleString() : value}
        </div>
        {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}
