import { NextResponse } from "next/server";

// ── PROTECTED ROUTES ────────────────────────────────────────────────────────
// Any route that starts with /dashboard requires authentication.
// If the access_token cookie is missing, redirect to /login immediately
// before the page even begins to render.
//
// NOTE: This checks for the cookie existence only — it does not verify
// the JWT signature (that happens on the backend with every API call).
// The layout.js getMe() call is the real auth check. Middleware just
// prevents the flash of the dashboard before the redirect fires.

const PROTECTED = ["/dashboard"];
const PUBLIC    = ["/login", "/register", "/forgot-password", "/"];

export function proxy(request) {
  const { pathname } = request.nextUrl;

  // Check if this is a protected route
  const isProtected = PROTECTED.some((route) => pathname.startsWith(route));

  if (!isProtected) {
    return NextResponse.next();
  }

  // Look for the access token cookie (set by backend as httpOnly)
  const accessToken = request.cookies.get("access_token");

  if (!accessToken) {
    // No token — redirect to login, preserve the intended destination
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Token exists — allow the request through
  // layout.js will verify it's actually valid via getMe()
  return NextResponse.next();
}

// ── MATCHER ─────────────────────────────────────────────────────────────────
// Only run middleware on dashboard routes.
// Skip _next (Next.js internals), static files, and API routes.
export const config = {
  matcher: [
    "/dashboard/:path*",
  ],
};