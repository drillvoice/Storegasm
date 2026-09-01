"use server";

/**
 * Server actions for items.
 *
 * Each action resolves the authenticated user from the Better Auth session —
 * the userId is never accepted from the client. This is the app-level
 * replacement for the RLS policies the schema had on Supabase.
 *
 * The environmentId, unlike the userId, IS supplied by the client: it is the
 * user's current scope selection, checked against the session user on every
 * call. Note that an item's own environment is derived from its space in the
 * data layer, so the environmentId here only decides where an *unassigned*
 * item lives.
 */

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { assertOwnedEnvironment } from "@/lib/db/environments";
import * as itemsDb from "@/lib/db/items";
import type {
  Item,
  ItemWithSpace,
  CreateItemPayload,
  UpdateItemPayload,
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

export async function fetchItemsBySpace(
  environmentId: string,
  spaceId: string
): Promise<DbResult<Item[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const owned = await assertOwnedEnvironment(userId, environmentId);
  if (owned.error) return { data: null, error: owned.error };
  return itemsDb.fetchItemsBySpace(userId, environmentId, spaceId);
}

export async function fetchUnassignedItems(
  environmentId: string
): Promise<DbResult<Item[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const owned = await assertOwnedEnvironment(userId, environmentId);
  if (owned.error) return { data: null, error: owned.error };
  return itemsDb.fetchUnassignedItems(userId, environmentId);
}

/** Pass a null environmentId to search across every environment. */
export async function searchItems(
  environmentId: string | null,
  query: string
): Promise<DbResult<ItemWithSpace[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  if (environmentId) {
    const owned = await assertOwnedEnvironment(userId, environmentId);
    if (owned.error) return { data: null, error: owned.error };
  }
  return itemsDb.searchItems(userId, environmentId, query);
}

export async function createItem(
  environmentId: string,
  payload: CreateItemPayload
): Promise<DbResult<Item>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const owned = await assertOwnedEnvironment(userId, environmentId);
  if (owned.error) return { data: null, error: owned.error };
  return itemsDb.createItem(userId, environmentId, payload);
}

export async function updateItem(
  itemId: string,
  payload: UpdateItemPayload
): Promise<DbResult<Item>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return itemsDb.updateItem(userId, itemId, payload);
}

export async function deleteItem(itemId: string): Promise<DbResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return itemsDb.deleteItem(userId, itemId);
}

export async function fetchAllTags(
  environmentId: string
): Promise<DbResult<string[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const owned = await assertOwnedEnvironment(userId, environmentId);
  if (owned.error) return { data: null, error: owned.error };
  return itemsDb.fetchAllTags(userId, environmentId);
}
