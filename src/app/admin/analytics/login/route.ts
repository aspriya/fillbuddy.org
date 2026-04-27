import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  buildSetCookieLogin,
  expectedCookieValue,
  getAdminToken,
  timingSafeEqual,
} from "@/lib/analytics/auth";

// POST /admin/analytics/login
//
// Form-encoded body: `token=<the admin token>`
//
// On success: 303 redirect to /admin/analytics, with Set-Cookie.
// On failure: 303 redirect to /admin/analytics?error=1 (no cookie set).

const REDIRECT_OK = "/admin/analytics";
const REDIRECT_FAIL = "/admin/analytics?error=1";

function isSecureRequest(request: NextRequest): boolean {
  // request.nextUrl.protocol is 'https:' / 'http:' on Vercel/Workers.
  // In Next dev over plain http we must NOT set Secure or the browser
  // will silently drop the cookie.
  return request.nextUrl.protocol === "https:";
}

export async function POST(request: NextRequest): Promise<Response> {
  const expectedToken = await getAdminToken();
  if (!expectedToken) {
    // Fail closed when the secret isn't configured.
    return NextResponse.redirect(new URL(REDIRECT_FAIL, request.url), {
      status: 303,
    });
  }

  let formToken = "";
  try {
    const form = await request.formData();
    const v = form.get("token");
    formToken = typeof v === "string" ? v : "";
  } catch {
    formToken = "";
  }

  if (!timingSafeEqual(formToken, expectedToken)) {
    return NextResponse.redirect(new URL(REDIRECT_FAIL, request.url), {
      status: 303,
    });
  }

  const cookieValue = await expectedCookieValue(expectedToken);
  const setCookie = buildSetCookieLogin(cookieValue, {
    secure: isSecureRequest(request),
  });

  const res = NextResponse.redirect(new URL(REDIRECT_OK, request.url), {
    status: 303,
  });
  res.headers.append("Set-Cookie", setCookie);
  return res;
}
