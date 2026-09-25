import "server-only";

import { getSessionUserId } from "@/lib/session";
import type { DbResult } from "@/lib/types";

/**
 * The shared shape of every GET route under app/api/ that reads app data.
 *
 * Reads used to be server actions, which the browser sends one at a time:
 * switching environment queued the space tree, the unassigned items and the
 * tag list behind each other. Plain GET requests run in parallel. Mutations
 * stay server actions — their queueing is harmless, and useful.
 *
 * Every route resolves the user from the session (never from the request),
 * and answers with the data layer's `{ data, error }` body so the client can
 * report the same messages the actions did.
 *
 * @param load - Loads the data for the session user. Validation failures
 *   should come back as `invalid(...)` so they get a 400.
 * @returns The JSON response.
 */
export async function readRoute<T>(
  load: (userId: string) => Promise<DbResult<T> | Invalid>
): Promise<Response> {
  const userId = await getSessionUserId();
  if (!userId) {
    return json({ data: null, error: { message: "Not authenticated" } }, 401);
  }
  const result = await load(userId);
  if (result instanceof Invalid) {
    return json({ data: null, error: { message: result.message } }, 400);
  }
  return json(result, result.error ? 500 : 200);
}

/** A request whose parameters failed validation. */
export class Invalid {
  constructor(readonly message: string) {}
}

/** Marks a validation failure for readRoute to answer with a 400. */
export function invalid(error: { message: string }): Invalid {
  return new Invalid(error.message);
}

function json(body: unknown, status: number): Response {
  // Per-user data: never let a browser or shared cache keep it.
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });
}
