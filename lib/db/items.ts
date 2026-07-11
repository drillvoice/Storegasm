import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { items, spaces } from "@/lib/db/schema";
import type {
  Item,
  ItemWithSpace,
  CreateItemPayload,
  UpdateItemPayload,
  DbResult,
} from "@/lib/types";

// Explicit column set so search_vector never leaks into payloads and rows
// match the Item interface exactly.
const itemColumns = {
  id: items.id,
  user_id: items.user_id,
  space_id: items.space_id,
  name: items.name,
  description: items.description,
  tags: items.tags,
  created_at: items.created_at,
  updated_at: items.updated_at,
};

function toDbError(e: unknown): { data: null; error: { message: string } } {
  return { data: null, error: { message: (e as Error).message } };
}

/**
 * Fetches all items assigned to a specific space.
 *
 * @param userId - The authenticated user's ID.
 * @param spaceId - The space UUID to filter by.
 * @returns An array of Item records ordered by name.
 */
export async function fetchItemsBySpace(
  userId: string,
  spaceId: string
): Promise<DbResult<Item[]>> {
  try {
    const data = await db
      .select(itemColumns)
      .from(items)
      .where(and(eq(items.user_id, userId), eq(items.space_id, spaceId)))
      .orderBy(asc(items.name));
    return { data, error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Fetches items with no assigned space.
 *
 * @param userId - The authenticated user's ID.
 * @returns An array of unassigned Item records.
 */
export async function fetchUnassignedItems(
  userId: string
): Promise<DbResult<Item[]>> {
  try {
    const data = await db
      .select(itemColumns)
      .from(items)
      .where(and(eq(items.user_id, userId), isNull(items.space_id)))
      .orderBy(asc(items.name));
    return { data, error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Full-text searches items and their full ancestor breadcrumb for a user.
 *
 * Uses Postgres tsvector search on the pre-computed search_vector column which
 * covers item name, description, and tags. Fetches all spaces in parallel to
 * build complete breadcrumb paths (e.g. "Bedroom › Under bed › Tub 1").
 *
 * @param userId - The authenticated user's ID.
 * @param query - The user's raw search query string.
 * @returns Items enriched with their full ancestor breadcrumb, ordered by name.
 */
export async function searchItems(
  userId: string,
  query: string
): Promise<DbResult<ItemWithSpace[]>> {
  if (!query.trim()) return { data: [], error: null };

  try {
    // Fetch matching items and the full space list in parallel.
    // The space list is needed to walk the ancestor chain for breadcrumbs.
    const [itemRows, spaceRows] = await Promise.all([
      db
        .select({
          ...itemColumns,
          space: { id: spaces.id, name: spaces.name },
        })
        .from(items)
        .leftJoin(spaces, eq(items.space_id, spaces.id))
        .where(
          and(
            eq(items.user_id, userId),
            sql`${items.search_vector} @@ websearch_to_tsquery('english', ${query})`
          )
        )
        .orderBy(asc(items.name)),
      db
        .select({
          id: spaces.id,
          name: spaces.name,
          parent_id: spaces.parent_id,
        })
        .from(spaces)
        .where(eq(spaces.user_id, userId)),
    ]);

    type SpaceRow = { id: string; name: string; parent_id: string | null };
    const spaceMap = new Map<string, SpaceRow>(spaceRows.map((s) => [s.id, s]));

    function buildPath(spaceId: string | null): string | null {
      if (!spaceId) return null;
      const parts: string[] = [];
      let cur: SpaceRow | undefined = spaceMap.get(spaceId);
      while (cur) {
        parts.unshift(cur.name);
        cur = cur.parent_id ? spaceMap.get(cur.parent_id) : undefined;
      }
      return parts.length > 0 ? parts.join(" › ") : null;
    }

    const result: ItemWithSpace[] = itemRows.map(({ space, ...row }) => ({
      ...row,
      tags: row.tags ?? [],
      space: space ?? null,
      space_path: buildPath(space?.id ?? null),
    }));

    return { data: result, error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Creates a new item.
 *
 * @param userId - The authenticated user's ID.
 * @param payload - The item fields to create.
 * @returns The newly created Item.
 */
export async function createItem(
  userId: string,
  payload: CreateItemPayload
): Promise<DbResult<Item>> {
  try {
    const rows = await db
      .insert(items)
      .values({ ...payload, user_id: userId, tags: payload.tags ?? [] })
      .returning(itemColumns);
    return { data: rows[0], error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Updates an existing item owned by the user.
 *
 * @param userId - The authenticated user's ID.
 * @param itemId - The UUID of the item to update.
 * @param payload - The fields to patch.
 * @returns The updated Item.
 */
export async function updateItem(
  userId: string,
  itemId: string,
  payload: UpdateItemPayload
): Promise<DbResult<Item>> {
  try {
    const rows = await db
      .update(items)
      .set(payload)
      .where(and(eq(items.id, itemId), eq(items.user_id, userId)))
      .returning(itemColumns);
    if (!rows[0]) {
      return { data: null, error: { message: "Item not found" } };
    }
    return { data: rows[0], error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Fetches all distinct tags used across a user's items, sorted alphabetically.
 *
 * @param userId - The authenticated user's ID.
 * @returns A sorted array of unique tag strings.
 */
export async function fetchAllTags(
  userId: string
): Promise<DbResult<string[]>> {
  try {
    const rows = await db
      .select({ tags: items.tags })
      .from(items)
      .where(eq(items.user_id, userId));
    const all = rows.flatMap((row) => row.tags ?? []);
    const unique = [...new Set(all)].sort();
    return { data: unique, error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Deletes an item owned by the user.
 *
 * @param userId - The authenticated user's ID.
 * @param itemId - The UUID of the item to delete.
 */
export async function deleteItem(
  userId: string,
  itemId: string
): Promise<DbResult<null>> {
  try {
    await db
      .delete(items)
      .where(and(eq(items.id, itemId), eq(items.user_id, userId)));
    return { data: null, error: null };
  } catch (e) {
    return toDbError(e);
  }
}
