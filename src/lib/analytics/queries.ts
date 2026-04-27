// Analytics queries against the `events` table in D1.
//
// All queries are server-side, called from the dashboard server component.
// Each function returns plain JSON that the React server tree can render.

import "server-only";

import type { EVENT_TYPES } from "./schema";

type EventTypeName = (typeof EVENT_TYPES)[number];

/* ── Daily KPI counters ─────────────────────────────────────── */

export interface DailyKpis {
  /** Counts indexed by event_type for the requested window. */
  uploads: number;
  downloads: number;
  saves: number;
  resumes: number;
  landingViews: number;
  appOpens: number;
  uniqueVisitors: number;
}

const ZERO_KPIS: DailyKpis = {
  uploads: 0,
  downloads: 0,
  saves: 0,
  resumes: 0,
  landingViews: 0,
  appOpens: 0,
  uniqueVisitors: 0,
};

/**
 * Counters for an arbitrary date window. `daysBack`:
 *   - 0 → today (UTC)
 *   - 1 → yesterday only
 *   - 7 → last 7 days inclusive
 *   - 30 → last 30 days inclusive
 */
export async function getKpiWindow(
  db: D1Database,
  daysBack: number
): Promise<DailyKpis> {
  // We use SQLite's date() with explicit UTC (events.date is stored UTC).
  // For "today" daysBack=0 we want events where date = date('now').
  // For daysBack=1 we want yesterday only: date = date('now','-1 day').
  // For windows >1 we want everything from date('now','-N days') onwards.
  const where =
    daysBack === 0
      ? "date = date('now')"
      : daysBack === 1
      ? "date = date('now','-1 day')"
      : `date >= date('now','-${daysBack - 1} days')`;

  const sql = `
    SELECT
      COALESCE(SUM(event_type = 'pdf_upload'), 0)        AS uploads,
      COALESCE(SUM(event_type = 'pdf_download'), 0)      AS downloads,
      COALESCE(SUM(event_type = 'fillbuddy_save'), 0)    AS saves,
      COALESCE(SUM(event_type = 'fillbuddy_upload'), 0)  AS resumes,
      COALESCE(SUM(event_type = 'landing_view'), 0)      AS landing_views,
      COALESCE(SUM(event_type = 'app_open'), 0)          AS app_opens,
      COUNT(DISTINCT visitor_id)                         AS unique_visitors
    FROM events
    WHERE ${where}
  `;
  const r = await db.prepare(sql).first<{
    uploads: number;
    downloads: number;
    saves: number;
    resumes: number;
    landing_views: number;
    app_opens: number;
    unique_visitors: number;
  }>();
  if (!r) return ZERO_KPIS;
  return {
    uploads: Number(r.uploads ?? 0),
    downloads: Number(r.downloads ?? 0),
    saves: Number(r.saves ?? 0),
    resumes: Number(r.resumes ?? 0),
    landingViews: Number(r.landing_views ?? 0),
    appOpens: Number(r.app_opens ?? 0),
    uniqueVisitors: Number(r.unique_visitors ?? 0),
  };
}

/* ── Daily totals time series (for the line chart) ──────────── */

export interface DailyRow {
  date: string;
  uploads: number;
  downloads: number;
  saves: number;
  resumes: number;
  landingViews: number;
}

export async function getDailySeries(
  db: D1Database,
  days: number
): Promise<DailyRow[]> {
  const sql = `
    SELECT
      date,
      COALESCE(SUM(event_type = 'pdf_upload'), 0)       AS uploads,
      COALESCE(SUM(event_type = 'pdf_download'), 0)     AS downloads,
      COALESCE(SUM(event_type = 'fillbuddy_save'), 0)   AS saves,
      COALESCE(SUM(event_type = 'fillbuddy_upload'), 0) AS resumes,
      COALESCE(SUM(event_type = 'landing_view'), 0)     AS landing_views
    FROM events
    WHERE date >= date('now', ?1)
    GROUP BY date
    ORDER BY date ASC
  `;
  const offset = `-${Math.max(0, days - 1)} days`;
  const { results } = await db
    .prepare(sql)
    .bind(offset)
    .all<{
      date: string;
      uploads: number;
      downloads: number;
      saves: number;
      resumes: number;
      landing_views: number;
    }>();
  return (results ?? []).map((r) => ({
    date: r.date,
    uploads: Number(r.uploads ?? 0),
    downloads: Number(r.downloads ?? 0),
    saves: Number(r.saves ?? 0),
    resumes: Number(r.resumes ?? 0),
    landingViews: Number(r.landing_views ?? 0),
  }));
}

/* ── Hour × day-of-week heatmap ─────────────────────────────── */

export interface HeatmapCell {
  /** 0=Mon, 6=Sun (matches the visual layout). */
  dow: number;
  hour: number;
  count: number;
}

/**
 * Returns a flat array of cells. Missing combinations are filled with 0.
 * Range: last `days` days inclusive of today.
 */
export async function getHourlyHeatmap(
  db: D1Database,
  days: number,
  eventType: EventTypeName = "pdf_upload"
): Promise<HeatmapCell[]> {
  // SQLite strftime('%w'): 0=Sunday..6=Saturday
  const sql = `
    SELECT
      CAST(strftime('%w', date) AS INTEGER) AS sqlite_dow,
      hour,
      COUNT(*) AS c
    FROM events
    WHERE date >= date('now', ?1)
      AND event_type = ?2
    GROUP BY sqlite_dow, hour
  `;
  const offset = `-${Math.max(0, days - 1)} days`;
  const { results } = await db
    .prepare(sql)
    .bind(offset, eventType)
    .all<{ sqlite_dow: number; hour: number; c: number }>();

  // Build a 7x24 grid initialised to 0, then fill from results.
  const grid: HeatmapCell[] = [];
  for (let dow = 0; dow < 7; dow++) {
    for (let hour = 0; hour < 24; hour++) {
      grid.push({ dow, hour, count: 0 });
    }
  }
  for (const r of results ?? []) {
    // Convert SQLite (0=Sun..6=Sat) to display (0=Mon..6=Sun).
    const sd = Number(r.sqlite_dow);
    const dow = (sd + 6) % 7;
    const hour = Number(r.hour);
    if (dow < 0 || dow > 6 || hour < 0 || hour > 23) continue;
    const idx = dow * 24 + hour;
    grid[idx].count = Number(r.c ?? 0);
  }
  return grid;
}

/* ── Country leaderboard ────────────────────────────────────── */

export interface CountryRow {
  country: string | null;
  events: number;
  uploads: number;
}

export async function getCountryLeaderboard(
  db: D1Database,
  days: number,
  limit = 20
): Promise<CountryRow[]> {
  const sql = `
    SELECT
      country,
      COUNT(*)                                     AS events,
      COALESCE(SUM(event_type = 'pdf_upload'), 0)  AS uploads
    FROM events
    WHERE date >= date('now', ?1)
    GROUP BY country
    ORDER BY events DESC
    LIMIT ?2
  `;
  const offset = `-${Math.max(0, days - 1)} days`;
  const { results } = await db
    .prepare(sql)
    .bind(offset, limit)
    .all<{ country: string | null; events: number; uploads: number }>();
  return (results ?? []).map((r) => ({
    country: r.country,
    events: Number(r.events ?? 0),
    uploads: Number(r.uploads ?? 0),
  }));
}

/* ── Device / browser / OS breakdown ────────────────────────── */

export interface BreakdownRow {
  label: string | null;
  count: number;
}

async function getBreakdown(
  db: D1Database,
  column: "device" | "browser" | "os",
  days: number
): Promise<BreakdownRow[]> {
  // Column name is whitelisted via the function signature so it's safe to interpolate.
  const sql = `
    SELECT ${column} AS label, COUNT(*) AS c
    FROM events
    WHERE date >= date('now', ?1)
      AND event_type IN ('pdf_upload', 'fillbuddy_upload', 'app_open')
    GROUP BY ${column}
    ORDER BY c DESC
  `;
  const offset = `-${Math.max(0, days - 1)} days`;
  const { results } = await db
    .prepare(sql)
    .bind(offset)
    .all<{ label: string | null; c: number }>();
  return (results ?? []).map((r) => ({
    label: r.label,
    count: Number(r.c ?? 0),
  }));
}

export const getDeviceBreakdown = (db: D1Database, days: number) =>
  getBreakdown(db, "device", days);
export const getBrowserBreakdown = (db: D1Database, days: number) =>
  getBreakdown(db, "browser", days);
export const getOsBreakdown = (db: D1Database, days: number) =>
  getBreakdown(db, "os", days);

/* ── Funnel: upload → download → save (last N days) ────────── */

export interface FunnelStats {
  sessionsWithUpload: number;
  sessionsCompleted: number;
  sessionsSaved: number;
  conversionPct: number | null;
  savePct: number | null;
}

export async function getFunnel(
  db: D1Database,
  days: number
): Promise<FunnelStats> {
  const sql = `
    WITH s AS (
      SELECT
        session_id,
        MAX(event_type = 'pdf_upload')      AS uploaded,
        MAX(event_type = 'pdf_download')    AS downloaded,
        MAX(event_type = 'fillbuddy_save')  AS saved
      FROM events
      WHERE date >= date('now', ?1)
        AND session_id IS NOT NULL
      GROUP BY session_id
    )
    SELECT
      COALESCE(SUM(uploaded), 0)                    AS up,
      COALESCE(SUM(uploaded AND downloaded), 0)     AS down,
      COALESCE(SUM(uploaded AND saved), 0)          AS sav
    FROM s
  `;
  const offset = `-${Math.max(0, days - 1)} days`;
  const r = await db
    .prepare(sql)
    .bind(offset)
    .first<{ up: number; down: number; sav: number }>();

  const up = Number(r?.up ?? 0);
  const down = Number(r?.down ?? 0);
  const sav = Number(r?.sav ?? 0);
  return {
    sessionsWithUpload: up,
    sessionsCompleted: down,
    sessionsSaved: sav,
    conversionPct: up > 0 ? Math.round((1000 * down) / up) / 10 : null,
    savePct: up > 0 ? Math.round((1000 * sav) / up) / 10 : null,
  };
}

/* ── Returning visitors ─────────────────────────────────────── */

export interface ReturningStats {
  oneTime: number;
  returning: number;
  totalKnown: number;
}

export async function getReturningStats(
  db: D1Database,
  days: number
): Promise<ReturningStats> {
  // NOTE: do NOT use `returning` as a column alias — it is a reserved
  // keyword in SQLite (RETURNING clause) and produces a syntax error.
  const sql = `
    SELECT
      SUM(CASE WHEN visit_days = 1 THEN 1 ELSE 0 END) AS one_time,
      SUM(CASE WHEN visit_days > 1 THEN 1 ELSE 0 END) AS ret
    FROM (
      SELECT visitor_id, COUNT(DISTINCT date) AS visit_days
      FROM events
      WHERE visitor_id IS NOT NULL
        AND date >= date('now', ?1)
      GROUP BY visitor_id
    )
  `;
  const offset = `-${Math.max(0, days - 1)} days`;
  const r = await db
    .prepare(sql)
    .bind(offset)
    .first<{ one_time: number | null; ret: number | null }>();
  const oneTime = Number(r?.one_time ?? 0);
  const returning = Number(r?.ret ?? 0);
  return { oneTime, returning, totalKnown: oneTime + returning };
}

/* ── Recent events feed (debug / activity ticker) ───────────── */

export interface RecentEventRow {
  ts: number;
  date: string;
  hour: number;
  eventType: string;
  country: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  pageCount: number | null;
  fileSizeBucket: string | null;
}

export async function getRecentEvents(
  db: D1Database,
  limit = 25
): Promise<RecentEventRow[]> {
  const sql = `
    SELECT ts, date, hour, event_type, country, device, browser, os,
           page_count, file_size_bucket
    FROM events
    ORDER BY ts DESC
    LIMIT ?1
  `;
  const { results } = await db
    .prepare(sql)
    .bind(limit)
    .all<{
      ts: number;
      date: string;
      hour: number;
      event_type: string;
      country: string | null;
      device: string | null;
      browser: string | null;
      os: string | null;
      page_count: number | null;
      file_size_bucket: string | null;
    }>();
  return (results ?? []).map((r) => ({
    ts: Number(r.ts),
    date: r.date,
    hour: Number(r.hour),
    eventType: r.event_type,
    country: r.country,
    device: r.device,
    browser: r.browser,
    os: r.os,
    pageCount: r.page_count == null ? null : Number(r.page_count),
    fileSizeBucket: r.file_size_bucket,
  }));
}
