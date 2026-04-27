import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildSetCookieLogout } from "@/lib/analytics/auth";

// POST /admin/analytics/logout
//
// Clears the session cookie and redirects to the dashboard, which will
// then render the login form because the cookie is no longer valid.

export async function POST(request: NextRequest): Promise<Response> {
  const secure = request.nextUrl.protocol === "https:";
  const res = NextResponse.redirect(
    new URL("/admin/analytics", request.url),
    { status: 303 }
  );
  res.headers.append("Set-Cookie", buildSetCookieLogout({ secure }));
  return res;
}
