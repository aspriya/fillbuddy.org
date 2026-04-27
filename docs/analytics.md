# FillBuddy — Anonymous Usage Analytics

> **Last updated:** 2026-04-27
> **Status:** Planned — not yet implemented
> **Storage:** Cloudflare D1 (binding `DB`)
> **Privacy posture:** No PDF bytes, no annotation content, no filenames, no IP addresses, no exact user agents. Country-level geo only. Random anonymous IDs only.

---

## 1. Why this exists

FillBuddy's product story is "your PDF never leaves your device." That stays true. What we *do* need to know — to make smart marketing decisions — is **how many people try the tool, where they're from, and whether the core flows actually work end-to-end**.

Specifically, the questions this analytics layer must answer:

1. How many people, per day and per hour, **upload a PDF and successfully download a filled version**? (the core success funnel)
2. How many people **save progress** as a `.fillbuddy` file? (use of the unique moat feature)
3. How many people **resume** from a previously saved `.fillbuddy` file? (retention / save-resume validation)
4. **Where in the world** are these users? (country only)
5. **What time of day / day of week** is peak usage? (ad scheduling, support coverage)
6. What **devices and browsers** do they use? (test priorities)
7. Are there technical problems — e.g., what % of uploads fail, what % use `overlay` engine vs `direct`?

This is fundamentally a **product analytics** layer, not behavioural tracking. We do not need clickstreams, session replay, or marketing attribution beyond referrer host.

---

## 2. What we collect (and what we deliberately don't)

### Collected per event

| Field | Source | Example | Purpose |
|---|---|---|---|
| `id` | Client UUID v4 | `8c1...` | Idempotency for retries |
| `event_type` | Client | `pdf_upload` | Funnel stage |
| `ts` | Server (Worker) | `1745740800000` | Time bucketing |
| `date` / `hour` | Server, derived from `ts` (UTC) | `2026-04-27` / `14` | Cheap GROUP BY |
| `visitor_id` | Client `localStorage` UUID | random | Returning-user counts |
| `session_id` | Client `sessionStorage` UUID | random | Funnel correlation within one visit |
| `country` | Cloudflare `request.cf.country` | `IN` | Geo (country only) |
| `device` | UA parser → category | `desktop` \| `mobile` \| `tablet` | Device mix |
| `browser` | UA parser → family | `chrome` \| `firefox` \| `safari` \| `edge` \| `other` | Compatibility focus |
| `os` | UA parser → family | `windows` \| `macos` \| `linux` \| `ios` \| `android` \| `other` | Compatibility focus |
| `referrer_host` | `document.referrer` host only | `google.com` | Marketing channel |
| `engine_mode` | App state | `direct` \| `overlay` | Tech health |
| `page_count` | App state | `5` | Workload sizing |
| `annotation_count` | App state (download/save only) | `12` | Engagement depth |
| `file_size_bucket` | Client, pre-bucketed | `1-5MB` | Workload sizing without leaking exact size |
| `was_encrypted` | App state | `0` / `1` | Encrypted-PDF support is a moat |
| `duration_ms` | Client, since session start | `47000` | Time-to-download |

### Explicitly NOT collected

- **PDF file bytes** or any derivative (text content, hashes of content)
- **Filename** (could be PII like `John-Doe-Tax-Return.pdf`)
- **Annotation text** or coordinates
- **IP address** — Cloudflare sees it but we never write it to D1
- **Exact User-Agent string** — only categorical fields
- **City, region, latitude/longitude** — country only by explicit choice
- **Email, name, account** — there are no accounts
- Any cross-site tracker, fingerprint, or third-party script

This is enforceable in code: the `/api/events` endpoint accepts a strict Zod schema and discards anything else.

---

## 3. Event taxonomy

Six event types. Add new ones cautiously — every new one means a new place to think about privacy.

| `event_type` | Fired when | Carries |
|---|---|---|
| `landing_view` | Landing page (`/`) loads | `referrer_host` |
| `app_open` | `/app` page loads | — |
| `pdf_upload` | A `.pdf` is parsed successfully (engines loaded, page count known) | `engine_mode`, `page_count`, `file_size_bucket`, `was_encrypted` |
| `fillbuddy_upload` | A `.fillbuddy` file is parsed and resume card shown | `page_count`, `annotation_count` |
| `pdf_download` | "Download PDF" succeeds (post-export, blob created) | `engine_mode`, `page_count`, `annotation_count`, `duration_ms` |
| `fillbuddy_save` | "Save Progress" succeeds (`.fillbuddy` blob created) | `page_count`, `annotation_count`, `duration_ms` |

Optional Phase-2 events (only if needed): `pdf_upload_failed`, `pdf_download_failed`, `signature_added`, `text_added`. The two failure events are valuable for diagnosing the engine fallback.

---

## 4. Architecture

```
                ┌────────────────────────────────────────┐
                │  Browser (existing client-side app)    │
                │                                        │
                │  ┌──────────────┐                     │
                │  │ trackEvent() │ ── batches in       │
                │  │ (lib/        │    sessionStorage   │
                │  │  analytics/) │    flushes via      │
                │  └──────┬───────┘    sendBeacon       │
                └─────────┼──────────────────────────────┘
                          │ POST /api/events  (gzip JSON)
                          ▼
                ┌────────────────────────────────────────┐
                │  Cloudflare Worker (Next.js)           │
                │  src/app/api/events/route.ts           │
                │  - Zod validate                        │
                │  - read request.cf.country             │
                │  - parse UA → device/browser/os        │
                │  - INSERT into D1 (binding DB)         │
                │  - rate limit per visitor_id (KV opt.) │
                └─────────────────┬──────────────────────┘
                                  ▼
                ┌────────────────────────────────────────┐
                │  Cloudflare D1 — events table          │
                │  + indexes for date/hour/country       │
                └─────────────────┬──────────────────────┘
                                  ▼
                ┌────────────────────────────────────────┐
                │  /admin/analytics  (SSR, auth-gated)    │
                │  - daily / hourly charts               │
                │  - funnel (upload → download)          │
                │  - geo & device breakdown              │
                └────────────────────────────────────────┘
```

All three pieces (capture, storage, dashboard) live in the same repo and the same Worker. No third-party analytics SDK. No external network calls from the browser.

---

## 5. D1 schema

Single table, denormalised on purpose — D1 read pricing is per-row-scanned, so we want narrow rows + good indexes, not joins.

```sql
-- drizzle/0001_analytics.sql
CREATE TABLE IF NOT EXISTS events (
  id                TEXT PRIMARY KEY,
  ts                INTEGER NOT NULL,                -- unix ms (server)
  date              TEXT    NOT NULL,                -- 'YYYY-MM-DD' UTC
  hour              INTEGER NOT NULL,                -- 0..23 UTC
  event_type        TEXT    NOT NULL,
  visitor_id        TEXT,
  session_id        TEXT,
  country           TEXT,                            -- ISO-2
  device            TEXT,
  browser           TEXT,
  os                TEXT,
  referrer_host     TEXT,
  engine_mode       TEXT,                            -- 'direct' | 'overlay'
  page_count        INTEGER,
  annotation_count  INTEGER,
  file_size_bucket  TEXT,                            -- '<100KB' | '100KB-1MB' | '1-5MB' | '5-20MB' | '>20MB'
  was_encrypted     INTEGER,                         -- 0/1
  duration_ms       INTEGER,
  CHECK (event_type IN (
    'landing_view','app_open','pdf_upload','fillbuddy_upload',
    'pdf_download','fillbuddy_save'
  ))
);

CREATE INDEX IF NOT EXISTS idx_events_date_type        ON events (date, event_type);
CREATE INDEX IF NOT EXISTS idx_events_date_hour_type   ON events (date, hour, event_type);
CREATE INDEX IF NOT EXISTS idx_events_country_date     ON events (country, date);
CREATE INDEX IF NOT EXISTS idx_events_session          ON events (session_id);
CREATE INDEX IF NOT EXISTS idx_events_visitor          ON events (visitor_id);
```

### Why a single wide table?

- Every dashboard query is `WHERE date BETWEEN ? AND ? GROUP BY <something>`. Indexes on `(date, event_type)` and `(date, hour, event_type)` make these O(matching rows).
- A 50-byte row × 100k events/day = 5 MB/day → ~150 MB/month. D1's 5 GB free quota covers ~3 years at that rate.
- Avoids per-request joins, which keeps Worker CPU under the request-path budget.

### Optional rollup table (only if dashboard queries get slow)

Once `events` exceeds ~5M rows, add a Cron Trigger that materialises hourly counts:

```sql
CREATE TABLE IF NOT EXISTS event_rollups_hourly (
  date        TEXT    NOT NULL,
  hour        INTEGER NOT NULL,
  event_type  TEXT    NOT NULL,
  country     TEXT,
  count       INTEGER NOT NULL,
  PRIMARY KEY (date, hour, event_type, country)
);
```

Don't build this on day one. Premature optimisation.

---

## 6. Wrangler config additions

Append to `wrangler.jsonc`:

```jsonc
"d1_databases": [
  { "binding": "DB", "database_name": "fillbuddy-analytics", "database_id": "<filled-after-create>" }
],
"vars": {
  "ANALYTICS_ENABLED": "true"
}
```

Provisioning steps (single time, run locally with `CLOUDFLARE_API_TOKEN` set per `docs/cloudflare-automation.md`):

```bash
npx wrangler d1 create fillbuddy-analytics
# -> writes database_id back into wrangler.jsonc under d1_databases[0]
npx wrangler d1 execute fillbuddy-analytics --local  --file ./drizzle/0001_analytics.sql
npx wrangler d1 execute fillbuddy-analytics --remote --file ./drizzle/0001_analytics.sql
npx wrangler types --env-interface CloudflareEnv cloudflare-env.d.ts
```

Admin password is a secret, not a `var`:

```bash
npx wrangler secret put ANALYTICS_ADMIN_TOKEN
```

---

## 7. Client-side capture

### File layout

```
src/lib/analytics/
  ids.ts          # getVisitorId(), getSessionId(), opt-out check
  ua.ts           # categorise navigator.userAgent → {device, browser, os}
  buckets.ts      # fileSizeBucket(bytes)
  client.ts       # trackEvent(type, payload) — public API
  schema.ts       # Zod schema shared with the route handler
```

### `client.ts` contract

```ts
type EventType =
  | 'landing_view' | 'app_open'
  | 'pdf_upload' | 'fillbuddy_upload'
  | 'pdf_download' | 'fillbuddy_save';

trackEvent(type: EventType, payload?: {
  engineMode?: 'direct' | 'overlay';
  pageCount?: number;
  annotationCount?: number;
  fileSizeBytes?: number;          // bucketed before send
  wasEncrypted?: boolean;
  durationMs?: number;
}): void
```

Behaviour:

- Reads `localStorage['fb_visitor_id']` (creates a UUID if missing).
- Reads `sessionStorage['fb_session_id']` (creates a UUID if missing).
- Skips entirely if `localStorage['fb_analytics_opt_out'] === '1'` (Do-Not-Track equivalent for power users; documented in privacy page).
- Resolves `referrer_host` from `document.referrer` (host part only, no path or query).
- POSTs JSON to `/api/events` via `navigator.sendBeacon` (fire-and-forget, survives page unload). Fallback to `fetch(..., { keepalive: true })`.
- Never blocks UX. Never throws into caller.

### Wire-up points (only 5 call sites)

| Where | Event |
|---|---|
| `src/app/page.tsx` (or a small client component mounted there) | `landing_view` |
| `src/app/app/page.tsx` mount | `app_open` |
| `UploadZone.tsx` after successful PDF parse | `pdf_upload` or `fillbuddy_upload` |
| `PdfAnnotator.tsx` "Download PDF" success path | `pdf_download` |
| `PdfAnnotator.tsx` "Save Progress" success path | `fillbuddy_save` |

That's it. No other instrumentation creep.

---

## 8. Server-side ingestion

`src/app/api/events/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getCloudflareContext } from '@opennextjs/cloudflare';

const Body = z.object({
  id: z.string().uuid(),
  type: z.enum([
    'landing_view','app_open','pdf_upload','fillbuddy_upload',
    'pdf_download','fillbuddy_save',
  ]),
  visitorId: z.string().uuid().nullish(),
  sessionId: z.string().uuid().nullish(),
  device: z.enum(['desktop','mobile','tablet','other']).nullish(),
  browser: z.enum(['chrome','firefox','safari','edge','other']).nullish(),
  os: z.enum(['windows','macos','linux','ios','android','other']).nullish(),
  referrerHost: z.string().max(120).nullish(),
  engineMode: z.enum(['direct','overlay']).nullish(),
  pageCount: z.number().int().nonnegative().max(10000).nullish(),
  annotationCount: z.number().int().nonnegative().max(100000).nullish(),
  fileSizeBucket: z.enum(['<100KB','100KB-1MB','1-5MB','5-20MB','>20MB']).nullish(),
  wasEncrypted: z.boolean().nullish(),
  durationMs: z.number().int().nonnegative().max(86_400_000).nullish(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });
  const e = parsed.data;

  const { env, cf } = getCloudflareContext();
  const country = (cf?.country as string | undefined) ?? null;

  const ts = Date.now();
  const d = new Date(ts);
  const date = d.toISOString().slice(0, 10);
  const hour = d.getUTCHours();

  await env.DB.prepare(
    `INSERT OR IGNORE INTO events
     (id, ts, date, hour, event_type, visitor_id, session_id, country,
      device, browser, os, referrer_host, engine_mode,
      page_count, annotation_count, file_size_bucket, was_encrypted, duration_ms)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).bind(
    e.id, ts, date, hour, e.type, e.visitorId ?? null, e.sessionId ?? null, country,
    e.device ?? null, e.browser ?? null, e.os ?? null, e.referrerHost ?? null,
    e.engineMode ?? null, e.pageCount ?? null, e.annotationCount ?? null,
    e.fileSizeBucket ?? null, e.wasEncrypted == null ? null : (e.wasEncrypted ? 1 : 0),
    e.durationMs ?? null,
  ).run();

  return NextResponse.json({ ok: true });
}
```

Notes:

- `INSERT OR IGNORE` makes retries idempotent on the client UUID.
- IP is never read or written. We only read `cf.country`.
- No `runtime = 'edge'` directive — the project runs on the Workers Node-compat runtime per `docs/tech-stack.md` §1.

### Abuse / cost protection

Anyone can POST to a public endpoint. Two cheap defences:

1. **Per-visitor rate limit** in KV: max ~120 events/min per `visitor_id` (a real user of FillBuddy will fire <10 events per minute realistically). Reject with 429.
2. **Origin check**: require `Origin` or `Referer` header to start with `https://fillbuddy.org` (or a configured list). Bots that strip this get dropped silently.

Skip both on day one; add when you see noise in the data.

---

## 9. Dashboard (`/admin/analytics`)

Server component, gated by a single shared password (`ANALYTICS_ADMIN_TOKEN`) checked against a cookie. Not for end users — for you only. Worth noting because it does NOT need Better Auth/Clerk yet.

### Pages / cards

1. **Today vs yesterday vs 7-day vs 30-day** counters: uploads, downloads, saves, resumes.
2. **Funnel** (last 7d / 30d):
   - Sessions with `pdf_upload`
   - Sessions that also got `pdf_download`
   - Sessions that also got `fillbuddy_save`
   - Conversion %
3. **Hourly heatmap** (24 cols × 7 rows): `pdf_upload` count by hour and day.
4. **Country bar chart**: top 20 countries by event count, last 30d.
5. **Device / browser / OS** pie or bar.
6. **Engine mode mix** + **encrypted PDF rate** — useful for tech health.
7. **`.fillbuddy` activity**: saves vs resumes by day. Tells you if save-and-resume is actually used.

### Sample queries

Daily totals (the headline numbers the user explicitly asked for):

```sql
SELECT
  date,
  SUM(event_type = 'pdf_upload')        AS uploads,
  SUM(event_type = 'pdf_download')      AS downloads,
  SUM(event_type = 'fillbuddy_save')    AS saves,
  SUM(event_type = 'fillbuddy_upload')  AS resumes
FROM events
WHERE date >= date('now','-30 days')
GROUP BY date
ORDER BY date DESC;
```

Hourly breakdown for a given day:

```sql
SELECT hour, event_type, COUNT(*) AS c
FROM events
WHERE date = ?1
GROUP BY hour, event_type
ORDER BY hour;
```

Upload → download conversion within the same session:

```sql
WITH s AS (
  SELECT session_id,
    MAX(event_type = 'pdf_upload')   AS uploaded,
    MAX(event_type = 'pdf_download') AS downloaded
  FROM events
  WHERE date >= date('now','-7 days') AND session_id IS NOT NULL
  GROUP BY session_id
)
SELECT
  SUM(uploaded)                       AS sessions_with_upload,
  SUM(uploaded AND downloaded)        AS sessions_completed,
  ROUND(100.0 * SUM(uploaded AND downloaded) / NULLIF(SUM(uploaded),0), 1) AS conversion_pct
FROM s;
```

Country leaderboard:

```sql
SELECT country, COUNT(*) AS uploads
FROM events
WHERE event_type = 'pdf_upload'
  AND date >= date('now','-30 days')
GROUP BY country
ORDER BY uploads DESC
LIMIT 20;
```

Returning-visitor rate (uses persistent `visitor_id`):

```sql
SELECT
  COUNT(DISTINCT visitor_id) FILTER (WHERE visit_count = 1) AS one_time,
  COUNT(DISTINCT visitor_id) FILTER (WHERE visit_count > 1) AS returning
FROM (
  SELECT visitor_id, COUNT(DISTINCT date) AS visit_count
  FROM events
  WHERE visitor_id IS NOT NULL
    AND date >= date('now','-30 days')
  GROUP BY visitor_id
);
```

---

## 10. Implementation plan (phased)

Keep each phase shippable on its own.

### Phase A — Plumbing (half a day)

- [ ] Add D1 binding to `wrangler.jsonc`
- [ ] `wrangler d1 create fillbuddy-analytics`
- [ ] `drizzle/0001_analytics.sql` + apply local + remote
- [ ] `wrangler types`
- [ ] `src/app/api/events/route.ts` with Zod
- [ ] Smoke test: `curl -X POST` and verify a row appears

### Phase B — Capture (half a day)

- [ ] `src/lib/analytics/{ids,ua,buckets,client,schema}.ts`
- [ ] Wire 5 call sites (landing, app open, upload, download, save)
- [ ] Update privacy copy on landing page footer + add `/privacy` page disclosing exactly what's in §2

### Phase C — Dashboard (one day)

- [ ] `/admin/analytics` server page, password-cookie gated
- [ ] Queries from §9 as `lib/analytics/queries.ts`
- [ ] Render with plain Tailwind grid + a tiny SVG bar/heatmap (no chart lib needed for v1)
- [ ] Optional: add Recharts later if more views

### Phase D (defer until needed)

- [ ] KV rate-limit on `/api/events`
- [ ] Cron trigger building `event_rollups_hourly`
- [ ] Workers Analytics Engine for high-cardinality stuff (e.g., per-minute counts) if D1 GROUP BY ever bites

---

## 11. Things this plan deliberately rejects

- **Google Analytics / Plausible / Posthog** — third-party scripts undermine the privacy story even if "anonymous". Self-hosted on D1 is the same effort and stays on-brand.
- **Storing IP, even hashed** — reversible enough to be a problem. Country from CF is sufficient.
- **City/region geo** — explicit user choice (see top of doc). Reconsider only if we need to choose ad-spend cities.
- **Heatmaps / session replay** — out of scope. Not what FillBuddy is.
- **Tracking annotation content or filenames** — a one-line bug here would torch the entire privacy promise. Schema doesn't have a column for it on purpose.
- **Edge runtime (`export const runtime = 'edge'`)** — banned by `docs/tech-stack.md` §12 and `AGENTS.md`.

---

## 12. Privacy disclosure copy (drop into `/privacy` page)

> **What we measure.** We log a small anonymous event (`pdf_upload`, `pdf_download`, `fillbuddy_save`, etc.) when you use FillBuddy, so we know how many people are using the tool and whether it works for them. Each event includes: a random ID generated in your browser (no name, no email), your country (from Cloudflare's network — never your IP address), your browser family (Chrome / Firefox / Safari / etc.), whether you're on desktop or mobile, the page count of your PDF, and the time. **We never log your PDF, your filename, what you typed into it, your IP address, or your exact location.** You can disable analytics entirely by running `localStorage.setItem('fb_analytics_opt_out','1')` in your browser console — the app respects this immediately.

---

## 13. Open questions to revisit later

- Should `/admin/analytics` move to Better Auth once a real auth layer exists? (Yes, but not until there's another reason to add auth.)
- Should `landing_view` be replaced by Cloudflare Web Analytics for the marketing page only, leaving D1 events for the in-app funnel? (Possibly cleaner, but doubles the surface area. Defer.)
- When is the right time to add Workers Analytics Engine alongside D1? (When a single dashboard query scans >1M rows.)
