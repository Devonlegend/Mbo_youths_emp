import { NextResponse } from "next/server";

// ── PROTECTED ROUTES ────────────────────────────────────────────────────────

const PROTECTED = ["/dashboard", "/admin"];
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

  return NextResponse.next();
}

// ── MATCHER ─────────────────────────────────────────────────────────────────
export const config = {
  matcher: [
    "/dashboard/:path*",
    "/admin/:path*",
  ],
};