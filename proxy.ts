import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Routes reachable without a session. The password-reset pages have to be
 * here: anyone using them is by definition unable to sign in.
 */
const PUBLIC_ROUTES = [
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
];

/** True when `pathname` is `route` itself or a path beneath it. */
function isUnder(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`);
}

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
  const isPublicRoute = PUBLIC_ROUTES.some((route) => isUnder(pathname, route));

  // Auth guard: redirect unauthenticated users away from app routes.
  if (!sessionCookie && !isPublicRoute) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from sign-in/sign-up. The reset pages
  // are deliberately excluded: a stale-but-present cookie must not block
  // someone from finishing a reset they started from their email.
  if (
    sessionCookie &&
    (isUnder(pathname, "/login") || isUnder(pathname, "/signup"))
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
     * Match all request paths except static files and Next.js internals. The
     * service worker and its offline page must be reachable signed out: the
     * browser refuses to register a worker whose script redirects, which it
     * did — to /login — whenever a signed-out page registered it.
     */
    "/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw\\.js$|offline\\.html$|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
