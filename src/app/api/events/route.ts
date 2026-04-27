import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { EventBody } from "@/lib/analytics/schema";

// POST /api/events — anonymous usage event ingestion.
// See docs/analytics.md for the full spec.
//
// What this endpoint does:
//   1. Validates the JSON body against the strict Zod schema (rejects unknown fields).
//   2. Reads the country code from Cloudflare's cf object — never the IP.
//   3. Inserts a single row into the D1 `events` table (INSERT OR IGNORE for retry idempotency).
//
// What this endpoint deliberately does NOT do:
//   - read or persist the client IP address
//   - read or persist the raw User-Agent
//   - read or persist anything from the request body that isn't in EventBody

export async function POST(request: NextRequest): Promise<Response> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const parsed = EventBody.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }
  const e = parsed.data;

  const { env, cf } = getCloudflareContext();
  const db = env.DB;
  if (!db) {
    // Should not happen in production. Surface a clear error in dev so the
    // wrangler.jsonc binding can be fixed.
    return NextResponse.json(
      { ok: false, error: "db_binding_missing" },
      { status: 500 }
    );
  }

  const country =
    typeof cf?.country === "string" ? cf.country.toUpperCase() : null;

  const ts = Date.now();
  const d = new Date(ts);
  const date = d.toISOString().slice(0, 10); // 'YYYY-MM-DD' UTC
  const hour = d.getUTCHours();

  try {
    await db
      .prepare(
        `INSERT OR IGNORE INTO events (
           id, ts, date, hour, event_type,
           visitor_id, session_id, country,
           device, browser, os, referrer_host,
           engine_mode, page_count, annotation_count,
           file_size_bucket, was_encrypted, duration_ms
         ) VALUES (?,?,?,?,?,  ?,?,?,  ?,?,?,?,  ?,?,?,  ?,?,?)`
      )
      .bind(
        e.id,
        ts,
        date,
        hour,
        e.type,
        e.visitorId ?? null,
        e.sessionId ?? null,
        country,
        e.device ?? null,
        e.browser ?? null,
        e.os ?? null,
        e.referrerHost ?? null,
        e.engineMode ?? null,
        e.pageCount ?? null,
        e.annotationCount ?? null,
        e.fileSizeBucket ?? null,
        e.wasEncrypted == null ? null : e.wasEncrypted ? 1 : 0,
        e.durationMs ?? null
      )
      .run();
  } catch (err) {
    console.error("events:insert_failed", err);
    return NextResponse.json({ ok: false, error: "db_write_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
