import type { EventBody, EventType } from "./schema";
import {
  getSessionAgeMs,
  getSessionId,
  getVisitorId,
  isOptedOut,
  newEventId,
} from "./ids";
import { categoriseUserAgent } from "./ua";
import { fileSizeBucket } from "./buckets";

const ENDPOINT = "/api/events";

/**
 * The shape callers pass to trackEvent. Note this is intentionally
 * smaller than the wire format — the client auto-fills visitor/session
 * IDs, UA categorisation, referrer host, and converts fileSizeBytes
 * into a bucket before sending. Anything not listed here cannot be
 * transmitted (the route handler also enforces this with .strict()).
 */
export interface TrackPayload {
  engineMode?: "direct" | "overlay";
  pageCount?: number;
  annotationCount?: number;
  fileSizeBytes?: number;
  wasEncrypted?: boolean;
}

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function safeReferrerHost(): string | undefined {
  if (!isBrowser()) return undefined;
  try {
    const ref = document.referrer;
    if (!ref) return undefined;
    const u = new URL(ref);
    // Don't echo our own host as a referrer — only external sources.
    if (u.host === window.location.host) return undefined;
    return u.host.slice(0, 120);
  } catch {
    return undefined;
  }
}

function getUaString(): string | undefined {
  if (!isBrowser()) return undefined;
  return navigator?.userAgent;
}

function buildBody(type: EventType, payload?: TrackPayload): EventBody {
  const ua = categoriseUserAgent(getUaString());
  const body: EventBody = {
    id: newEventId(),
    type,
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    device: ua.device,
    browser: ua.browser,
    os: ua.os,
    referrerHost: safeReferrerHost() ?? null,
    engineMode: payload?.engineMode ?? null,
    pageCount: payload?.pageCount ?? null,
    annotationCount: payload?.annotationCount ?? null,
    fileSizeBucket: fileSizeBucket(payload?.fileSizeBytes) ?? null,
    wasEncrypted: payload?.wasEncrypted ?? null,
    durationMs: getSessionAgeMs() ?? null,
  };
  return body;
}

/**
 * Fire-and-forget event tracker. Never throws.
 *
 * Best-effort delivery via navigator.sendBeacon (survives page unload),
 * with a fetch(keepalive) fallback for browsers/contexts where Beacon
 * is unavailable.
 */
export function trackEvent(type: EventType, payload?: TrackPayload): void {
  if (!isBrowser()) return;
  if (isOptedOut()) return;

  let body: EventBody;
  try {
    body = buildBody(type, payload);
  } catch {
    return;
  }

  const json = JSON.stringify(body);

  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      const blob = new Blob([json], { type: "application/json" });
      const ok = navigator.sendBeacon(ENDPOINT, blob);
      if (ok) return;
      // sendBeacon returned false (queue full / disabled) — fall through.
    }
  } catch {
    /* fall through to fetch */
  }

  try {
    void fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: json,
      keepalive: true,
      credentials: "omit",
      mode: "same-origin",
    }).catch(() => {
      /* swallow — analytics must never affect UX */
    });
  } catch {
    /* swallow */
  }
}
