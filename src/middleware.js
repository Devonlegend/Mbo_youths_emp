import { NextResponse } from "next/server";

// ── PROTECTED ROUTES ────────────────────────────────────────────────────────
// NOTE: /dashboard and /admin are intentionally NOT protected here.
// Auth cookies are set by the Django backend (different origin/port), so this
// middleware can't reliably see them. Auth is instead enforced client-side —
// see DashboardLayout and admin layout, which call getMe() and redirect
// unauthenticated users to /login.

const PROTECTED = [];
const PUBLIC    = ["/login", "/register", "/forgot-password", "/"];

export function middleware(request) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED.some((route) => pathname.startsWith(route));

  if (!isProtected) {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get("access_token");

  if (!accessToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [],
};