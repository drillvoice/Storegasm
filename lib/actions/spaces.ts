"use server";

/**
 * Server actions for spaces.
 *
 * Each action resolves the authenticated user from the Better Auth session —
 * the userId is never accepted from the client — and parses every argument it
 * does accept against lib/validation.ts before it reaches the data layer.
 *
 * The environmentId, unlike the userId, IS supplied by the client: it is the
 * user's current scope selection. Every action that takes one checks it
 * belongs to the session user first, so a forged id can at worst show the
 * caller their own other environment.
 */

import { assertOwnedEnvironment } from "@/lib/db/environments";
import * as spacesDb from "@/lib/db/spaces";
import { getSessionUserId, NOT_AUTHENTICATED } from "@/lib/session";
import {
  createSpaceInput,
  environmentIdInput,
  moveSpaceInput,
  parseInput,
  spaceIdInput,
  updateSpaceInput,
} from "@/lib/validation";
import type {
  Space,
  SpaceNode,
  CreateSpacePayload,
  UpdateSpacePayload,
  MoveSpacePayload,
  DbResult,
} from "@/lib/types";

export async function fetchSpaceTree(
  environmentId: string
): Promise<DbResult<SpaceNode[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput, environmentId);
  if (envId.error) return envId;
  const owned = await assertOwnedEnvironment(userId, envId.data);
  if (owned.error) return { data: null, error: owned.error };
  return spacesDb.fetchSpaceTree(userId, envId.data);
}

export async function fetchSpace(
  spaceId: string
): Promise<DbResult<Space | null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const id = parseInput(spaceIdInput, spaceId);
  // A malformed id can't name a space — answer "not found" like any other
  // unknown id, so a mangled URL lands on the page's not-found state.
  if (id.error) return { data: null, error: null };
  return spacesDb.fetchSpace(userId, id.data);
}

export async function createSpace(
  environmentId: string,
  payload: CreateSpacePayload
): Promise<DbResult<Space>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput, environmentId);
  if (envId.error) return envId;
  const input = parseInput(createSpaceInput, payload);
  if (input.error) return input;
  const owned = await assertOwnedEnvironment(userId, envId.data);
  if (owned.error) return { data: null, error: owned.error };
  return spacesDb.createSpace(userId, envId.data, input.data);
}

export async function updateSpace(
  spaceId: string,
  payload: UpdateSpacePayload
): Promise<DbResult<Space>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const id = parseInput(spaceIdInput, spaceId);
  if (id.error) return id;
  const input = parseInput(updateSpaceInput, payload);
  if (input.error) return input;
  return spacesDb.updateSpace(userId, id.data, input.data);
}

/** Moves a space, its subtree, and its items into another environment. */
export async function moveSpace(
  spaceId: string,
  payload: MoveSpacePayload
): Promise<DbResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const id = parseInput(spaceIdInput, spaceId);
  if (id.error) return id;
  const input = parseInput(moveSpaceInput, payload);
  if (input.error) return input;
  const owned = await assertOwnedEnvironment(userId, input.data.environment_id);
  if (owned.error) return { data: null, error: owned.error };
  return spacesDb.moveSpaceToEnvironment(
    userId,
    id.data,
    input.data.environment_id,
    input.data.parent_id
  );
}

export async function deleteSpace(spaceId: string): Promise<DbResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const id = parseInput(spaceIdInput, spaceId);
  if (id.error) return id;
  return spacesDb.deleteSpace(userId, id.data);
}

export async function fetchChildSpaces(
  environmentId: string,
  parentId: string | null
): Promise<DbResult<Space[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput, environmentId);
  if (envId.error) return envId;
  const parent = parseInput(spaceIdInput.nullable(), parentId);
  if (parent.error) return parent;
  const owned = await assertOwnedEnvironment(userId, envId.data);
  if (owned.error) return { data: null, error: owned.error };
  return spacesDb.fetchChildSpaces(userId, envId.data, parent.data);
}
