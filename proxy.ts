import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Optimistic auth guard for all app routes.
 *
 * Checks only for the presence of the Better Auth session cookie — fast and
 * good enough for routing decisions. Real session validation happens
 * server-side in app/(app)/layout.tsx and in every server action, so a stale
 * or forged cookie can never reach data.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Better Auth's own endpoints must always pass through.
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  const sessionCookie = getSessionCookie(request);

  // Auth guard: redirect unauthenticated users away from app routes.
  if (
    !sessionCookie &&
    !pathname.startsWith("/login") &&
    !pathname.startsWith("/signup")
  ) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from auth pages.
  if (
    sessionCookie &&
    (pathname.startsWith("/login") || pathname.startsWith("/signup"))
  ) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = "/dashboard";
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files and Next.js internals.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
