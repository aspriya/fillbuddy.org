import type { Metadata } from "next";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import Link from "next/link";

import { getAdminToken, isAdminAuthed } from "@/lib/analytics/auth";
import {
  getCountryLeaderboard,
  getDailySeries,
  getDeviceBreakdown,
  getBrowserBreakdown,
  getOsBreakdown,
  getFunnel,
  getHourlyHeatmap,
  getKpiWindow,
  getRecentEvents,
  getReturningStats,
} from "@/lib/analytics/queries";

import LoginForm from "@/components/admin/LoginForm";
import MetricCard from "@/components/admin/MetricCard";
import LineChart from "@/components/admin/LineChart";
import Heatmap from "@/components/admin/Heatmap";
import CountryBar from "@/components/admin/CountryBar";
import BreakdownBars from "@/components/admin/BreakdownBars";
import FunnelCard from "@/components/admin/FunnelCard";
import RecentEventsTable from "@/components/admin/RecentEventsTable";

export const metadata: Metadata = {
  title: "Analytics — FillBuddy Admin",
  robots: { index: false, follow: false },
};

// The dashboard always reflects "now" — no static caching.
export const dynamic = "force-dynamic";

interface SearchParamsLike {
  error?: string;
}

export default async function AnalyticsAdminPage(props: {
  searchParams: Promise<SearchParamsLike>;
}) {
  const sp = await props.searchParams;

  // 1) Token must be configured at all.
  const token = await getAdminToken();
  if (!token) {
    return <LoginForm notConfigured />;
  }

  // 2) User must have a valid session cookie.
  const authed = await isAdminAuthed();
  if (!authed) {
    return <LoginForm error={sp?.error === "1"} />;
  }

  // 3) Authed — pull all the data and render the dashboard.
  const { env } = await getCloudflareContext({ async: true });
  const db = env?.DB;
  if (!db) {
    return (
      <div className="min-h-screen bg-slate-50 p-10 text-sm text-slate-700">
        D1 binding <code>DB</code> is not available.
      </div>
    );
  }

  const [
    today,
    yest,
    last7,
    last30,
    series30,
    heatmap30,
    countries,
    devices,
    browsers,
    oss,
    funnel7,
    funnel30,
    returning30,
    recent,
  ] = await Promise.all([
    getKpiWindow(db, 0),
    getKpiWindow(db, 1),
    getKpiWindow(db, 7),
    getKpiWindow(db, 30),
    getDailySeries(db, 30),
    getHourlyHeatmap(db, 30, "pdf_upload"),
    getCountryLeaderboard(db, 30, 20),
    getDeviceBreakdown(db, 30),
    getBrowserBreakdown(db, 30),
    getOsBreakdown(db, 30),
    getFunnel(db, 7),
    getFunnel(db, 30),
    getReturningStats(db, 30),
    getRecentEvents(db, 25),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-10 py-4 flex items-center justify-between">
          <div>
            <Link
              href="/"
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              fillbuddy.org
            </Link>
            <h1 className="font-heading text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Analytics
            </h1>
          </div>
          <form action="/admin/analytics/logout" method="POST">
            <button
              type="submit"
              className="text-xs font-semibold text-slate-500 hover:text-slate-700 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 sm:px-10 py-8 space-y-8">
        {/* ── Headline counters ─────────────────────────────────────── */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Today (UTC)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Uploads"      value={today.uploads}        accent="amber"   sub={`vs ${yest.uploads} yesterday`} />
            <MetricCard label="Downloads"    value={today.downloads}      accent="emerald" sub={`vs ${yest.downloads} yesterday`} />
            <MetricCard label="Saves"        value={today.saves}          accent="sky"     sub={`vs ${yest.saves} yesterday`} />
            <MetricCard label="Resumes"      value={today.resumes}        accent="violet"  sub={`vs ${yest.resumes} yesterday`} />
            <MetricCard label="App opens"    value={today.appOpens}       accent="slate"   sub={`vs ${yest.appOpens} yesterday`} />
            <MetricCard label="Visitors"     value={today.uniqueVisitors} accent="slate"   sub="distinct visitor IDs" />
          </div>
        </section>

        <section>
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Last 30 days
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <MetricCard label="Uploads"   value={last30.uploads}        accent="amber"   />
            <MetricCard label="Downloads" value={last30.downloads}      accent="emerald" />
            <MetricCard label="Saves"     value={last30.saves}          accent="sky"     />
            <MetricCard label="Resumes"   value={last30.resumes}        accent="violet"  />
            <MetricCard label="Landing"   value={last30.landingViews}   accent="slate"   />
            <MetricCard label="Visitors"  value={last30.uniqueVisitors} accent="slate"   />
          </div>
        </section>

        {/* ── Trend ─────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Daily trend — last 30 days (UTC)
          </h2>
          <LineChart data={series30} />
        </section>

        {/* ── Funnel + returning + 7d quick ─────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FunnelCard stats={funnel7}  windowLabel="last 7 days" />
          <FunnelCard stats={funnel30} windowLabel="last 30 days" />
          <div className="rounded-2xl bg-white border border-slate-200 p-4">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
              Visitors (30 days)
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wider">
                  One-time
                </div>
                <div className="text-2xl font-extrabold text-slate-900 tabular-nums mt-1">
                  {returning30.oneTime.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[11px] text-slate-500 uppercase tracking-wider">
                  Returning
                </div>
                <div className="text-2xl font-extrabold text-emerald-600 tabular-nums mt-1">
                  {returning30.returning.toLocaleString()}
                </div>
              </div>
            </div>
            <div className="mt-3 text-xs text-slate-500">
              Across {returning30.totalKnown.toLocaleString()} known visitor IDs.
              Last 7 days: {last7.uniqueVisitors.toLocaleString()} unique.
            </div>
          </div>
        </section>

        {/* ── Heatmap ───────────────────────────────────────────────── */}
        <section>
          <Heatmap cells={heatmap30} metricLabel="Uploads" />
        </section>

        {/* ── Geo + Tech ───────────────────────────────────────────── */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CountryBar rows={countries} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <BreakdownBars title="Device — 30d" rows={devices} />
            <BreakdownBars title="Browser — 30d" rows={browsers} />
            <BreakdownBars title="OS — 30d" rows={oss} />
          </div>
        </section>

        {/* ── Recent ────────────────────────────────────────────────── */}
        <section>
          <RecentEventsTable rows={recent} />
        </section>

        <p className="text-[11px] text-slate-400 text-center pt-4">
          All times in UTC. Counts are anonymous events; see{" "}
          <Link href="/privacy" className="underline hover:text-slate-600">
            privacy
          </Link>
          .
        </p>
      </main>
    </div>
  );
}
