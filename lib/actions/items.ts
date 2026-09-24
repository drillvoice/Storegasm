"use server";

/**
 * Server actions for items.
 *
 * Each action resolves the authenticated user from the Better Auth session —
 * the userId is never accepted from the client — and parses every argument it
 * does accept against lib/validation.ts before it reaches the data layer.
 *
 * The environmentId, unlike the userId, IS supplied by the client: it is the
 * user's current scope selection. It needs no ownership check here: reads
 * filter on user_id as well, so another user's environment id matches
 * nothing, and writes are refused by the (environment_id, user_id) foreign
 * keys in lib/db/schema.ts. Note that an item's own environment is derived
 * from its space in the data layer, so the environmentId here only decides
 * where an *unassigned* item lives.
 */

import * as itemsDb from "@/lib/db/items";
import { getSessionUserId, NOT_AUTHENTICATED } from "@/lib/session";
import {
  createItemInput,
  environmentIdInput,
  itemIdInput,
  parseInput,
  searchQueryInput,
  spaceIdInput,
  updateItemInput,
} from "@/lib/validation";
import type {
  Item,
  ItemWithSpace,
  CreateItemPayload,
  UpdateItemPayload,
  DbResult,
} from "@/lib/types";

export async function fetchItemsBySpace(
  environmentId: string,
  spaceId: string
): Promise<DbResult<Item[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput, environmentId);
  if (envId.error) return envId;
  // A malformed space id can't hold anything — answer with an empty list, as
  // for any other unknown space, so a mangled URL shows an empty page.
  const space = parseInput(spaceIdInput, spaceId);
  if (space.error) return { data: [], error: null };
  return itemsDb.fetchItemsBySpace(userId, envId.data, space.data);
}

export async function fetchUnassignedItems(
  environmentId: string
): Promise<DbResult<Item[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput, environmentId);
  if (envId.error) return envId;
  return itemsDb.fetchUnassignedItems(userId, envId.data);
}

/** Pass a null environmentId to search across every environment. */
export async function searchItems(
  environmentId: string | null,
  query: string
): Promise<DbResult<ItemWithSpace[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput.nullable(), environmentId);
  if (envId.error) return envId;
  const q = parseInput(searchQueryInput, query);
  if (q.error) return q;
  return itemsDb.searchItems(userId, envId.data, q.data);
}

export async function createItem(
  environmentId: string,
  payload: CreateItemPayload
): Promise<DbResult<Item>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput, environmentId);
  if (envId.error) return envId;
  const input = parseInput(createItemInput, payload);
  if (input.error) return input;
  return itemsDb.createItem(userId, envId.data, input.data);
}

export async function updateItem(
  itemId: string,
  payload: UpdateItemPayload
): Promise<DbResult<Item>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const id = parseInput(itemIdInput, itemId);
  if (id.error) return id;
  const input = parseInput(updateItemInput, payload);
  if (input.error) return input;
  return itemsDb.updateItem(userId, id.data, input.data);
}

export async function deleteItem(itemId: string): Promise<DbResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const id = parseInput(itemIdInput, itemId);
  if (id.error) return id;
  return itemsDb.deleteItem(userId, id.data);
}

export async function fetchAllTags(
  environmentId: string
): Promise<DbResult<string[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput, environmentId);
  if (envId.error) return envId;
  return itemsDb.fetchAllTags(userId, envId.data);
}
