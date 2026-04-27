import type { RecentEventRow } from "@/lib/analytics/queries";
import { countryFlag, countryName } from "@/lib/analytics/countries";

interface Props {
  rows: RecentEventRow[];
}

const TYPE_TONE: Record<string, string> = {
  landing_view: "bg-slate-100 text-slate-600",
  app_open: "bg-violet-100 text-violet-700",
  pdf_upload: "bg-amber-100 text-amber-700",
  fillbuddy_upload: "bg-sky-100 text-sky-700",
  pdf_download: "bg-emerald-100 text-emerald-700",
  fillbuddy_save: "bg-blue-100 text-blue-700",
};

export default function RecentEventsTable({ rows }: Props) {
  return (
    <div className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 text-xs font-semibold uppercase tracking-wider text-slate-500">
        Latest activity
      </div>
      {rows.length === 0 ? (
        <div className="text-sm text-slate-400 py-8 text-center">No events yet.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-100">
                <th className="px-4 py-2 text-left font-semibold">When</th>
                <th className="px-4 py-2 text-left font-semibold">Event</th>
                <th className="px-4 py-2 text-left font-semibold">Country</th>
                <th className="px-4 py-2 text-left font-semibold">Device · Browser</th>
                <th className="px-4 py-2 text-right font-semibold">Pages</th>
                <th className="px-4 py-2 text-right font-semibold">Size</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const tone = TYPE_TONE[r.eventType] ?? "bg-slate-100 text-slate-600";
                return (
                  <tr
                    key={`${r.ts}-${i}`}
                    className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/60"
                  >
                    <td className="px-4 py-2 text-slate-600 tabular-nums whitespace-nowrap">
                      {formatRelativeOrDate(r.ts)}
                    </td>
                    <td className="px-4 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold ${tone}`}>
                        {r.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-slate-700">
                      <span className="mr-1.5" aria-hidden>
                        {r.country ? countryFlag(r.country) : "🌐"}
                      </span>
                      {countryName(r.country)}
                    </td>
                    <td className="px-4 py-2 text-slate-600 capitalize">
                      {[r.device, r.browser].filter(Boolean).join(" · ") || "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600 tabular-nums text-right">
                      {r.pageCount ?? "—"}
                    </td>
                    <td className="px-4 py-2 text-slate-600 tabular-nums text-right whitespace-nowrap">
                      {r.fileSizeBucket ?? "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function formatRelativeOrDate(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  if (diff < 0) return new Date(ts).toLocaleString();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const date = new Date(ts);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
}
