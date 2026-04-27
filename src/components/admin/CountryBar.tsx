import type { CountryRow } from "@/lib/analytics/queries";
import { countryFlag, countryName } from "@/lib/analytics/countries";

interface Props {
  rows: CountryRow[];
}

export default function CountryBar({ rows }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl bg-white border border-slate-200 p-6 text-sm text-slate-400 text-center">
        No country data yet.
      </div>
    );
  }
  const max = Math.max(...rows.map((r) => r.events), 1);

  return (
    <div className="rounded-2xl bg-white border border-slate-200 p-4">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
        Top countries — last 30d
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const pct = (r.events / max) * 100;
          return (
            <li key={(r.country ?? "_unknown") + r.events}>
              <div className="flex items-center gap-2 text-sm">
                <span className="text-base leading-none w-5 text-center" aria-hidden>
                  {r.country ? countryFlag(r.country) : "🌐"}
                </span>
                <span className="text-slate-700 font-medium truncate flex-1">
                  {countryName(r.country)}
                </span>
                <span className="tabular-nums text-slate-500 text-xs">
                  {r.events.toLocaleString()}
                </span>
              </div>
              <div className="mt-0.5 ml-7 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-amber-500/80"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
