# FillBuddy — Anonymous Usage Analytics

> **Last updated:** 2026-04-27
> **Status:** Phases A, B, C shipped. Phase D deferred.
> **Storage:** Cloudflare D1 (binding `DB`, database `fillbuddy-analytics`)
> **Dashboard:** [`/admin/analytics`](https://fillbuddy.org/admin/analytics) (gated by `ANALYTICS_ADMIN_TOKEN`)
> **Privacy posture:** No PDF bytes, no annotation content, no filenames, no IP addresses, no exact user agents. Country-level geo only. Random anonymous IDs only.
>
> **Source of truth (live code, not this doc):**
> - Capture client: `src/lib/analytics/{ids,ua,buckets,client,schema}.ts`
> - Ingest endpoint: `src/app/api/events/route.ts`
> - Dashboard queries: `src/lib/analytics/queries.ts`
> - Dashboard UI: `src/app/admin/analytics/page.tsx`, `src/components/admin/*`
> - Auth: `src/lib/analytics/auth.ts`
> - Schema migration: `drizzle/0001_analytics.sql`

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

## 6. Wrangler config & provisioning

The D1 binding lives in `wrangler.jsonc` under `d1_databases` (binding `DB`, database `fillbuddy-analytics`). The schema lives in `drizzle/0001_analytics.sql` and has been applied to both `--local` and `--remote`.

The admin token is a Wrangler secret (not a `var`):

```bash
npx wrangler secret put ANALYTICS_ADMIN_TOKEN
```

For local dev the same value goes in `.env.local` (gitignored; see `.env.local.example`).

---

## 7. Client-side capture

Live code: `src/lib/analytics/{ids,ua,buckets,client,schema}.ts`. Public API:

```ts
trackEvent(type: EventType, payload?: {
  engineMode?: 'direct' | 'overlay';
  pageCount?: number;
  annotationCount?: number;
  fileSizeBytes?: number;     // bucketed before send
  wasEncrypted?: boolean;
}): void
```

Key invariants enforced in code:

- Visitor ID lives in `localStorage['fb_visitor_id']` (persistent, anonymous UUID).
- Session ID lives in `sessionStorage['fb_session_id']` (fresh per tab).
- Skips entirely if `localStorage['fb_analytics_opt_out'] === '1'`.
- `referrer_host` derived from `document.referrer` host part only; same-origin referrers are dropped.
- File size always bucketed client-side before send — the raw byte count never leaves the browser.
- Auto-fills `device`/`browser`/`os` from a categorical UA classifier (`ua.ts`); the raw User-Agent string never leaves the browser.
- Transport: `navigator.sendBeacon` with `fetch(..., { keepalive: true })` fallback. Fire-and-forget. Never blocks UX, never throws.

### Wire-up points (the 5 shipped call sites)

| Event | Site |
|---|---|
| `landing_view` | `src/app/page.tsx` via `<AnalyticsBeacon>` |
| `app_open` | `src/app/app/page.tsx` mount |
| `pdf_upload` | `src/app/app/page.tsx` — handleUpload (regular PDF branch) |
| `fillbuddy_upload` | `src/app/app/page.tsx` — handleUpload (`.fillbuddy` resume branch) |
| `pdf_download` | `src/components/PdfAnnotator.tsx` — `handleDownload` success |
| `fillbuddy_save` | `src/components/PdfAnnotator.tsx` — `handleSaveProgress` success |

That's it. No other instrumentation creep.

### Known gaps (not yet wired)

- `engineMode` and `wasEncrypted` are accepted by the schema but not currently surfaced by the upload flow (which doesn't call `extractFields`). The dashboard renders these as `NULL` for now. Backfilling is straightforward when needed.

---

## 8. Server-side ingestion

Live code: `src/app/api/events/route.ts`. Schema: `src/lib/analytics/schema.ts` (shared with the client).

Key invariants:

- Strict Zod validation with `.strict()` — unknown keys are rejected, so the client can never accidentally smuggle a `filename` or `userAgent` field into the table.
- `INSERT OR IGNORE` keyed on the client UUID — retries (e.g. sendBeacon double-fires) are idempotent.
- IP address is never read or written. Country comes from `cf.country` only.
- `ts` / `date` / `hour` are derived **server-side** from `Date.now()` (UTC). The client cannot influence these.
- No `runtime = 'edge'` directive — runs on the Workers Node-compat runtime per `docs/tech-stack.md` §1.

### Abuse / cost protection

Anyone can POST to a public endpoint. Two cheap defences:

1. **Per-visitor rate limit** in KV: max ~120 events/min per `visitor_id` (a real user of FillBuddy will fire <10 events per minute realistically). Reject with 429.
2. **Origin check**: require `Origin` or `Referer` header to start with `https://fillbuddy.org` (or a configured list). Bots that strip this get dropped silently.

Skip both on day one; add when you see noise in the data.

---

## 9. Dashboard (`/admin/analytics`)

Server component, gated by a single shared password (`ANALYTICS_ADMIN_TOKEN`) checked against a cookie. Not for end users — for you only. Worth noting because it does NOT need Better Auth/Clerk yet.

### Auth implementation (chosen approach)

We use a **shared-token + signed-cookie** scheme, not bcrypt:

- `ANALYTICS_ADMIN_TOKEN` is a long random secret (Wrangler secret in prod, `.env.local` in dev — never `vars` in `wrangler.jsonc`).
- Login form POSTs `token` to `/admin/analytics/login`, the route compares with **constant-time equality**.
- On success, the route sets an `HttpOnly; SameSite=Strict; Path=/admin` cookie containing `sha256(token + ":fb-admin-v1")` in hex. The cookie value is meaningless without knowing the secret.
- Every dashboard request re-derives the expected cookie value from the env secret and compares — no server-side session storage needed.
- The `Secure` flag is added only when `request.nextUrl.protocol === 'https:'` so `next dev` over plain http still works.

Why not bcrypt? The secret here is pre-shared, not a user-typed weak password, so a slow KDF buys nothing. Web Crypto SHA-256 is simpler, faster, and zero extra deps.

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

### Queries

Live code: `src/lib/analytics/queries.ts`. Each function is documented inline. Highlights:

- `getKpiWindow(db, daysBack)` — counters for today / yesterday / 7d / 30d, plus distinct-visitor count.
- `getDailySeries(db, days)` — per-day totals for the trend line chart.
- `getHourlyHeatmap(db, days, eventType)` — 7×24 grid of counts.
- `getCountryLeaderboard(db, days, limit)` — top countries by event count.
- `getDeviceBreakdown` / `getBrowserBreakdown` / `getOsBreakdown` — share-of-traffic by category.
- `getFunnel(db, days)` — sessions that uploaded → downloaded → saved, with conversion percentages.
- `getReturningStats(db, days)` — one-time vs returning visitors based on persistent visitor ID.
- `getRecentEvents(db, limit)` — activity feed for the dashboard table.

**Gotcha:** `returning` is a reserved SQLite keyword (RETURNING clause). Don't use it as a column alias — `getReturningStats` uses `ret` instead and remaps in JS.

---

## 10. Implementation status

### Phase A — Plumbing ✅

- D1 binding `DB` (`fillbuddy-analytics`) added to `wrangler.jsonc`.
- `drizzle/0001_analytics.sql` applied to local + remote.
- `src/app/api/events/route.ts` with strict Zod validation.
- Smoke-tested with `curl` — row appears with `country` populated from `cf-ipcountry`.

### Phase B — Capture ✅ (commit `d5fac4b`)

- `src/lib/analytics/{ids,ua,buckets,client,schema}.ts` shipped.
- All 5 wire-up sites instrumented (see §7 table).
- `/privacy` page added with full disclosure + opt-out instructions.
- Privacy link added to landing footer.

### Phase C — Dashboard ✅ (commit `9e6dd3c`)

- `/admin/analytics` server page, gated by `ANALYTICS_ADMIN_TOKEN`.
- Auth: shared-token + signed-cookie via Web Crypto SHA-256 (see §9).
- Login + logout routes (`/admin/analytics/{login,logout}`).
- All queries in `src/lib/analytics/queries.ts`.
- UI: pure server-rendered Tailwind + SVG (`src/components/admin/*`). No chart library, no client JS.

### Phase D — Deferred until needed

- [ ] KV rate-limit on `/api/events` — add when abuse appears.
- [ ] Cron trigger building `event_rollups_hourly` — add when `events` exceeds ~5M rows.
- [ ] Workers Analytics Engine for high-cardinality stuff — add when a single dashboard query scans >1M rows.
- [ ] Backfill `engineMode` / `wasEncrypted` from the upload flow (see §7 "Known gaps").

---

## 11. Things this plan deliberately rejects

- **Google Analytics / Plausible / Posthog** — third-party scripts undermine the privacy story even if "anonymous". Self-hosted on D1 is the same effort and stays on-brand.
- **Storing IP, even hashed** — reversible enough to be a problem. Country from CF is sufficient.
- **City/region geo** — explicit user choice (see top of doc). Reconsider only if we need to choose ad-spend cities.
- **Heatmaps / session replay** — out of scope. Not what FillBuddy is.
- **Tracking annotation content or filenames** — a one-line bug here would torch the entire privacy promise. Schema doesn't have a column for it on purpose.
- **Edge runtime (`export const runtime = 'edge'`)** — banned by `docs/tech-stack.md` §12 and `AGENTS.md`.

---

## 12. Privacy disclosure

Live page: [`/privacy`](https://fillbuddy.org/privacy). Source: `src/app/privacy/page.tsx`.

If anything in §2 or §7 changes, the privacy page must change too — they are the user-facing summary of the same contract.

---

## 13. Open questions to revisit later

- Should `/admin/analytics` move to Better Auth once a real auth layer exists? (Yes, but not until there's another reason to add auth.)
- Should `landing_view` be replaced by Cloudflare Web Analytics for the marketing page only, leaving D1 events for the in-app funnel? (Possibly cleaner, but doubles the surface area. Defer.)
- When is the right time to add Workers Analytics Engine alongside D1? (When a single dashboard query scans >1M rows.)
