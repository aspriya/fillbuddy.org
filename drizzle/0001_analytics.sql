-- FillBuddy analytics — initial schema.
-- See docs/analytics.md §5 for design rationale.
--
-- Apply locally:
--   npx wrangler d1 execute fillbuddy-analytics --local  --file ./drizzle/0001_analytics.sql
-- Apply remotely:
--   npx wrangler d1 execute fillbuddy-analytics --remote --file ./drizzle/0001_analytics.sql

CREATE TABLE IF NOT EXISTS events (
  id                TEXT PRIMARY KEY,                -- client-supplied UUID v4 (idempotency)
  ts                INTEGER NOT NULL,                -- unix ms (server-set)
  date              TEXT    NOT NULL,                -- 'YYYY-MM-DD' UTC (server-derived)
  hour              INTEGER NOT NULL,                -- 0..23 UTC (server-derived)
  event_type        TEXT    NOT NULL,
  visitor_id        TEXT,                            -- anonymous, persistent (localStorage)
  session_id        TEXT,                            -- anonymous, per-session (sessionStorage)
  country           TEXT,                            -- ISO-2 (from Cloudflare cf.country only)
  device            TEXT,                            -- 'desktop' | 'mobile' | 'tablet' | 'other'
  browser           TEXT,                            -- 'chrome' | 'firefox' | 'safari' | 'edge' | 'other'
  os                TEXT,                            -- 'windows' | 'macos' | 'linux' | 'ios' | 'android' | 'other'
  referrer_host     TEXT,                            -- host only, no path/query
  engine_mode       TEXT,                            -- 'direct' | 'overlay'
  page_count        INTEGER,
  annotation_count  INTEGER,
  file_size_bucket  TEXT,                            -- '<100KB' | '100KB-1MB' | '1-5MB' | '5-20MB' | '>20MB'
  was_encrypted     INTEGER,                         -- 0 / 1
  duration_ms       INTEGER,                         -- since session start
  CHECK (event_type IN (
    'landing_view', 'app_open',
    'pdf_upload', 'fillbuddy_upload',
    'pdf_download', 'fillbuddy_save'
  ))
);

CREATE INDEX IF NOT EXISTS idx_events_date_type      ON events (date, event_type);
CREATE INDEX IF NOT EXISTS idx_events_date_hour_type ON events (date, hour, event_type);
CREATE INDEX IF NOT EXISTS idx_events_country_date   ON events (country, date);
CREATE INDEX IF NOT EXISTS idx_events_session        ON events (session_id);
CREATE INDEX IF NOT EXISTS idx_events_visitor        ON events (visitor_id);
