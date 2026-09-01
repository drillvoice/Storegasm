import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { environments, items, spaces } from "@/lib/db/schema";
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
  environment_id: items.environment_id,
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
 * Looks up which environment a space is in.
 *
 * An item's environment always follows its space, so wherever a space is
 * given the client's idea of the current environment is ignored in favour of
 * this — that is what makes "move this item into a space in the new house"
 * also move the item to the new house.
 *
 * @param userId - The authenticated user's ID.
 * @param spaceId - The space to look up.
 * @returns The environment id, or null when the space isn't the user's.
 */
async function environmentOfSpace(
  userId: string,
  spaceId: string
): Promise<string | null> {
  const rows = await db
    .select({ environment_id: spaces.environment_id })
    .from(spaces)
    .where(and(eq(spaces.id, spaceId), eq(spaces.user_id, userId)))
    .limit(1);
  return rows[0]?.environment_id ?? null;
}

/**
 * Fetches all items assigned to a specific space.
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The environment to scope to.
 * @param spaceId - The space UUID to filter by.
 * @returns An array of Item records ordered by name.
 */
export async function fetchItemsBySpace(
  userId: string,
  environmentId: string,
  spaceId: string
): Promise<DbResult<Item[]>> {
  try {
    const data = await db
      .select(itemColumns)
      .from(items)
      .where(
        and(
          eq(items.user_id, userId),
          eq(items.environment_id, environmentId),
          eq(items.space_id, spaceId)
        )
      )
      .orderBy(asc(items.name));
    return { data, error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Fetches items in an environment that have no assigned space.
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The environment to scope to.
 * @returns An array of unassigned Item records.
 */
export async function fetchUnassignedItems(
  userId: string,
  environmentId: string
): Promise<DbResult<Item[]>> {
  try {
    const data = await db
      .select(itemColumns)
      .from(items)
      .where(
        and(
          eq(items.user_id, userId),
          eq(items.environment_id, environmentId),
          isNull(items.space_id)
        )
      )
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
 * covers item name, description, and tags. Fetches all spaces and environments
 * in parallel to build complete breadcrumb paths (e.g. "Bedroom › Under bed ›
 * Tub 1").
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The environment to scope to, or null to search every
 *   environment — the "is it still at the old place?" case during a move.
 * @param query - The user's raw search query string.
 * @returns Items enriched with their full ancestor breadcrumb, ordered by name.
 */
export async function searchItems(
  userId: string,
  environmentId: string | null,
  query: string
): Promise<DbResult<ItemWithSpace[]>> {
  if (!query.trim()) return { data: [], error: null };

  try {
    // Fetch matching items, the full space list, and the environment list in
    // parallel. The space list is needed to walk the ancestor chain for
    // breadcrumbs; the environment list labels each result's place.
    const [itemRows, spaceRows, environmentRows] = await Promise.all([
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
            environmentId ? eq(items.environment_id, environmentId) : undefined,
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
      db
        .select({ id: environments.id, name: environments.name })
        .from(environments)
        .where(eq(environments.user_id, userId)),
    ]);

    type SpaceRow = { id: string; name: string; parent_id: string | null };
    const spaceMap = new Map<string, SpaceRow>(spaceRows.map((s) => [s.id, s]));
    const environmentMap = new Map(environmentRows.map((e) => [e.id, e]));

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
      environment: environmentMap.get(row.environment_id) ?? null,
    }));

    return { data: result, error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Creates a new item. Its environment follows its space when one is given,
 * otherwise the active environment.
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The active environment, used when the item is unassigned.
 * @param payload - The item fields to create.
 * @returns The newly created Item.
 */
export async function createItem(
  userId: string,
  environmentId: string,
  payload: CreateItemPayload
): Promise<DbResult<Item>> {
  try {
    const resolved = payload.space_id
      ? await environmentOfSpace(userId, payload.space_id)
      : environmentId;
    if (!resolved) {
      return { data: null, error: { message: "Space not found" } };
    }
    const rows = await db
      .insert(items)
      .values({
        ...payload,
        user_id: userId,
        environment_id: resolved,
        tags: payload.tags ?? [],
      })
      .returning(itemColumns);
    return { data: rows[0], error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Updates an existing item owned by the user.
 *
 * When the patch changes space_id the environment is re-derived from the new
 * space, so moving an item into a space in another environment moves the item
 * there too. Unassigning an item leaves it in the environment it came from.
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
    let patch: UpdateItemPayload & { environment_id?: string } = payload;

    if (payload.space_id) {
      const resolved = await environmentOfSpace(userId, payload.space_id);
      if (!resolved) {
        return { data: null, error: { message: "Space not found" } };
      }
      patch = { ...payload, environment_id: resolved };
    }

    const rows = await db
      .update(items)
      .set(patch)
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
 * Fetches all distinct tags used across a user's items in one environment,
 * sorted alphabetically.
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The environment to scope to.
 * @returns A sorted array of unique tag strings.
 */
export async function fetchAllTags(
  userId: string,
  environmentId: string
): Promise<DbResult<string[]>> {
  try {
    const rows = await db
      .select({ tags: items.tags })
      .from(items)
      .where(
        and(
          eq(items.user_id, userId),
          eq(items.environment_id, environmentId)
        )
      );
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
