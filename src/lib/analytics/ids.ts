// Anonymous identifier management for analytics.
//
// Privacy contract:
// - All IDs are random UUIDs created in the user's browser. They contain
//   zero information about the user.
// - `visitorId` lives in localStorage. It lets us tell "the same browser
//   came back next week" without anything resembling PII.
// - `sessionId` lives in sessionStorage. It is fresh for every tab/visit
//   and is what we use to correlate upload -> download in a funnel.
// - The user can opt out of analytics entirely by setting
//   `localStorage.fb_analytics_opt_out = '1'` in their browser console.
//
// All accessors are SSR-safe — they return null when called on the server.

const VISITOR_KEY = "fb_visitor_id";
const SESSION_KEY = "fb_session_id";
const SESSION_START_KEY = "fb_session_start";
const OPT_OUT_KEY = "fb_analytics_opt_out";

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function safeRandomUUID(): string {
  // crypto.randomUUID is in all modern browsers and Workers.
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback for very old browsers — RFC 4122 v4 from Math.random.
  // Not cryptographically strong, but adequate for a non-secret tracking ID.
  const rnd = (n: number) =>
    Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  return `${rnd(8)}-${rnd(4)}-4${rnd(3)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${rnd(3)}-${rnd(12)}`;
}

function readLS(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeLS(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* private mode / quota — silently ignore */
  }
}

function readSS(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSS(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    /* private mode / quota — silently ignore */
  }
}

export function isOptedOut(): boolean {
  if (!isBrowser()) return false;
  return readLS(OPT_OUT_KEY) === "1";
}

export function getVisitorId(): string | null {
  if (!isBrowser()) return null;
  let id = readLS(VISITOR_KEY);
  if (!id) {
    id = safeRandomUUID();
    writeLS(VISITOR_KEY, id);
  }
  return id;
}

export function getSessionId(): string | null {
  if (!isBrowser()) return null;
  let id = readSS(SESSION_KEY);
  if (!id) {
    id = safeRandomUUID();
    writeSS(SESSION_KEY, id);
    writeSS(SESSION_START_KEY, String(Date.now()));
  }
  return id;
}

/**
 * Returns ms elapsed since the current session started, or null if we
 * can't determine it (SSR, no storage, etc).
 */
export function getSessionAgeMs(): number | null {
  if (!isBrowser()) return null;
  // Make sure a session exists (also seeds the start ts if it didn't).
  getSessionId();
  const start = readSS(SESSION_START_KEY);
  if (!start) return null;
  const n = Number(start);
  if (!Number.isFinite(n)) return null;
  const age = Date.now() - n;
  return age >= 0 ? age : null;
}

/**
 * One-shot UUID for a single event. Each event gets its own id so that
 * sendBeacon retries / browser refires hit `INSERT OR IGNORE` cleanly.
 */
export function newEventId(): string {
  return safeRandomUUID();
}
