// Server-only authentication helpers for /admin/analytics.
//
// Threat model:
//   - Single admin (the project maintainer).
//   - Token is a high-entropy secret stored as a Wrangler secret.
//   - Dashboard exposes anonymous usage data, not PII, but still gated.
//
// Approach:
//   1. The user posts the raw token to /admin/analytics/login.
//   2. We compare with constant-time equality. If equal:
//   3. We set an HttpOnly cookie containing sha256(token + ":<NS>") in hex.
//      The cookie value is meaningless without knowing the secret, so even
//      if it leaks (e.g. via XSS — though HttpOnly mitigates that), it
//      doesn't reveal the password.
//   4. On every dashboard request we re-derive the expected cookie value
//      from the env secret and compare to the incoming cookie.
//
// We deliberately do NOT use bcrypt: the secret here is not a user-typed
// password but a pre-shared token, so a slow KDF buys nothing. Web Crypto
// SHA-256 + constant-time compare is correct and fast.

import "server-only";

import { getCloudflareContext } from "@opennextjs/cloudflare";
import { cookies } from "next/headers";

const COOKIE_NAME = "fb_admin_session";
const COOKIE_NAMESPACE = "fb-admin-v1"; // bumped if cookie format ever changes
const SESSION_MAX_AGE_S = 60 * 60 * 24 * 7; // 7 days

/**
 * Read the admin token from Cloudflare env (production) or process.env
 * (local `next dev`, populated from `.env.local`). Returns undefined
 * when the secret hasn't been configured.
 */
export async function getAdminToken(): Promise<string | undefined> {
  // Async mode is the safe choice in server components — see
  // node_modules/@opennextjs/cloudflare/dist/api/cloudflare-context.js.
  try {
    const { env } = await getCloudflareContext({ async: true });
    if (env?.ANALYTICS_ADMIN_TOKEN) return env.ANALYTICS_ADMIN_TOKEN;
  } catch {
    // No platform proxy available — fall through to process.env.
  }
  if (typeof process !== "undefined" && process.env?.ANALYTICS_ADMIN_TOKEN) {
    return process.env.ANALYTICS_ADMIN_TOKEN;
  }
  return undefined;
}

/** Constant-time string comparison. Returns false on length mismatch. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) {
    r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return r === 0;
}

/** SHA-256 of UTF-8 input, returned as lowercase hex. */
async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input)
  );
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Cookie value the browser should send if it has authenticated with `token`. */
export async function expectedCookieValue(token: string): Promise<string> {
  return sha256Hex(`${token}:${COOKIE_NAMESPACE}`);
}

/**
 * Returns true if the request currently has a valid admin session cookie.
 * Returns false if the token isn't configured, the cookie is missing, or
 * the cookie value is wrong.
 */
export async function isAdminAuthed(): Promise<boolean> {
  const token = await getAdminToken();
  if (!token) return false;
  const c = await cookies();
  const got = c.get(COOKIE_NAME)?.value;
  if (!got) return false;
  const expected = await expectedCookieValue(token);
  return timingSafeEqual(got, expected);
}

/**
 * Build the `Set-Cookie` header value used after a successful login.
 *
 * `secure` is decided by the caller because in `next dev` (http://) the
 * Secure flag would prevent the cookie from being stored at all.
 */
export function buildSetCookieLogin(value: string, opts: { secure: boolean }): string {
  const parts = [
    `${COOKIE_NAME}=${value}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/admin",
    `Max-Age=${SESSION_MAX_AGE_S}`,
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

/** `Set-Cookie` header value used to clear the session. */
export function buildSetCookieLogout(opts: { secure: boolean }): string {
  const parts = [
    `${COOKIE_NAME}=`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/admin",
    "Max-Age=0",
  ];
  if (opts.secure) parts.push("Secure");
  return parts.join("; ");
}

export const ADMIN_COOKIE_NAME = COOKIE_NAME;
