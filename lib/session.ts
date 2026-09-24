import "server-only";

import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";

/**
 * The Better Auth session for the current request.
 *
 * Wrapped in React's cache() so the layout and the page — which render in
 * parallel — share one lookup instead of each making their own.
 */
export const getSession = cache(async () =>
  auth.api.getSession({ headers: await headers() })
);

/**
 * Resolves the signed-in user for a server action or server component.
 *
 * The userId is only ever taken from the Better Auth session — never from the
 * client. That is the app-level replacement for the RLS policies the schema
 * had on Supabase, so every action calls this before touching data.
 *
 * @returns The session user's id, or null when there is no valid session.
 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await getSession();
  return session?.user.id ?? null;
}

/** What an action returns when called without a valid session. */
export const NOT_AUTHENTICATED = {
  data: null,
  error: { message: "Not authenticated" },
} as const;
