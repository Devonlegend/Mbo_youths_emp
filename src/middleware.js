import { NextResponse } from "next/server";

// Auth is checked client-side in dashboard/layout.js and admin/layout.js
// via getMe(), not here. The access_token cookie is scoped to the
// backend's domain (Railway), not this frontend's domain, so middleware
// running on this server can never read it — checking it here always
// fails and redirects even logged-in users. Real protection still comes
// from Django's IsAuthenticated permission on the API itself.

export function middleware(request) {
  return NextResponse.next();
}

export const config = {
  matcher: [],
};
