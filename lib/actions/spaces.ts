"use server";

/**
 * Server actions for spaces.
 *
 * Each action resolves the authenticated user from the Better Auth session —
 * the userId is never accepted from the client. This is the app-level
 * replacement for the RLS policies the schema had on Supabase.
 */

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import * as spacesDb from "@/lib/db/spaces";
import type {
  Space,
  SpaceNode,
  CreateSpacePayload,
  UpdateSpacePayload,
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

export async function fetchSpaceTree(): Promise<DbResult<SpaceNode[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return spacesDb.fetchSpaceTree(userId);
}

export async function fetchSpace(
  spaceId: string
): Promise<DbResult<Space | null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return spacesDb.fetchSpace(userId, spaceId);
}

export async function createSpace(
  payload: CreateSpacePayload
): Promise<DbResult<Space>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return spacesDb.createSpace(userId, payload);
}

export async function updateSpace(
  spaceId: string,
  payload: UpdateSpacePayload
): Promise<DbResult<Space>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return spacesDb.updateSpace(userId, spaceId, payload);
}

export async function deleteSpace(spaceId: string): Promise<DbResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return spacesDb.deleteSpace(userId, spaceId);
}

export async function fetchChildSpaces(
  parentId: string | null
): Promise<DbResult<Space[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return spacesDb.fetchChildSpaces(userId, parentId);
}
