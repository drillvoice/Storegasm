"use server";

/**
 * Server actions for spaces.
 *
 * Each action resolves the authenticated user from the Better Auth session —
 * the userId is never accepted from the client. This is the app-level
 * replacement for the RLS policies the schema had on Supabase.
 *
 * The environmentId, unlike the userId, IS supplied by the client: it is the
 * user's current scope selection. Every action that takes one checks it
 * belongs to the session user first, so a forged id can at worst show the
 * caller their own other environment.
 */

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { assertOwnedEnvironment } from "@/lib/db/environments";
import * as spacesDb from "@/lib/db/spaces";
import type {
  Space,
  SpaceNode,
  CreateSpacePayload,
  UpdateSpacePayload,
  MoveSpacePayload,
  DbResult,
} from "@/lib/types";

async function getSessionUserId(): Promise<string | null> {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user.id ?? null;
}

const NOT_AUTHENTICATED = {
  data: null,
  error: { message: "Not authenticated" },
} as const;

export async function fetchSpaceTree(
  environmentId: string
): Promise<DbResult<SpaceNode[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const owned = await assertOwnedEnvironment(userId, environmentId);
  if (owned.error) return { data: null, error: owned.error };
  return spacesDb.fetchSpaceTree(userId, environmentId);
}

export async function fetchSpace(
  spaceId: string
): Promise<DbResult<Space | null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return spacesDb.fetchSpace(userId, spaceId);
}

export async function createSpace(
  environmentId: string,
  payload: CreateSpacePayload
): Promise<DbResult<Space>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const owned = await assertOwnedEnvironment(userId, environmentId);
  if (owned.error) return { data: null, error: owned.error };
  return spacesDb.createSpace(userId, environmentId, payload);
}

export async function updateSpace(
  spaceId: string,
  payload: UpdateSpacePayload
): Promise<DbResult<Space>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return spacesDb.updateSpace(userId, spaceId, payload);
}

/** Moves a space, its subtree, and its items into another environment. */
export async function moveSpace(
  spaceId: string,
  payload: MoveSpacePayload
): Promise<DbResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const owned = await assertOwnedEnvironment(userId, payload.environment_id);
  if (owned.error) return { data: null, error: owned.error };
  return spacesDb.moveSpaceToEnvironment(
    userId,
    spaceId,
    payload.environment_id,
    payload.parent_id
  );
}

export async function deleteSpace(spaceId: string): Promise<DbResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return spacesDb.deleteSpace(userId, spaceId);
}

export async function fetchChildSpaces(
  environmentId: string,
  parentId: string | null
): Promise<DbResult<Space[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const owned = await assertOwnedEnvironment(userId, environmentId);
  if (owned.error) return { data: null, error: owned.error };
  return spacesDb.fetchChildSpaces(userId, environmentId, parentId);
}
