"use server";

/**
 * Server actions for items.
 *
 * Each action resolves the authenticated user from the Better Auth session —
 * the userId is never accepted from the client. This is the app-level
 * replacement for the RLS policies the schema had on Supabase.
 */

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
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
  spaceId: string
): Promise<DbResult<Item[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return itemsDb.fetchItemsBySpace(userId, spaceId);
}

export async function fetchUnassignedItems(): Promise<DbResult<Item[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return itemsDb.fetchUnassignedItems(userId);
}

export async function searchItems(
  query: string
): Promise<DbResult<ItemWithSpace[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return itemsDb.searchItems(userId, query);
}

export async function createItem(
  payload: CreateItemPayload
): Promise<DbResult<Item>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return itemsDb.createItem(userId, payload);
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

export async function fetchAllTags(): Promise<DbResult<string[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return itemsDb.fetchAllTags(userId);
}
