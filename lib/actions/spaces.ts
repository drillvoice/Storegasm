"use server";

/**
 * Server actions for spaces.
 *
 * Each action resolves the authenticated user from the Better Auth session —
 * the userId is never accepted from the client — and parses every argument it
 * does accept against lib/validation.ts before it reaches the data layer.
 *
 * The environmentId, unlike the userId, IS supplied by the client: it is the
 * user's current scope selection. It needs no ownership check here: reads
 * filter on user_id as well, so another user's environment id matches
 * nothing, and writes are refused by the (environment_id, user_id) foreign
 * keys in lib/db/schema.ts.
 */

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
  CreateSpacePayload,
  UpdateSpacePayload,
  MoveSpacePayload,
  DbResult,
} from "@/lib/types";

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

