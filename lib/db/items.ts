import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Item,
  ItemWithSpace,
  CreateItemPayload,
  UpdateItemPayload,
  DbResult,
} from "@/lib/types";

/**
 * Fetches all items assigned to a specific space.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param spaceId - The space UUID to filter by.
 * @returns An array of Item records ordered by name.
 */
export async function fetchItemsBySpace(
  client: SupabaseClient,
  userId: string,
  spaceId: string
): Promise<DbResult<Item[]>> {
  const { data, error } = await client
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .eq("space_id", spaceId)
    .order("name");

  if (error) return { data: null, error };
  return { data: data ?? [], error: null };
}

/**
 * Fetches items with no assigned space.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @returns An array of unassigned Item records.
 */
export async function fetchUnassignedItems(
  client: SupabaseClient,
  userId: string
): Promise<DbResult<Item[]>> {
  const { data, error } = await client
    .from("items")
    .select("*")
    .eq("user_id", userId)
    .is("space_id", null)
    .order("name");

  if (error) return { data: null, error };
  return { data: data ?? [], error: null };
}

/**
 * Full-text searches items and their full ancestor breadcrumb for a user.
 *
 * Uses Postgres tsvector search on the pre-computed search_vector column which
 * covers item name, description, and tags. Fetches all spaces in parallel to
 * build complete breadcrumb paths (e.g. "Bedroom › Under bed › Tub 1").
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param query - The user's raw search query string.
 * @returns Items enriched with their full ancestor breadcrumb, ordered by name.
 */
export async function searchItems(
  client: SupabaseClient,
  userId: string,
  query: string
): Promise<DbResult<ItemWithSpace[]>> {
  if (!query.trim()) return { data: [], error: null };

  // Fetch matching items and the full space list in parallel.
  // The space list is needed to walk the ancestor chain for breadcrumbs.
  const [itemResult, spacesResult] = await Promise.all([
    client
      .from("items")
      .select("*, spaces(id, name)")
      .eq("user_id", userId)
      .textSearch("search_vector", query, { type: "websearch", config: "english" })
      .order("name"),
    client
      .from("spaces")
      .select("id, name, parent_id")
      .eq("user_id", userId),
  ]);

  if (itemResult.error) return { data: null, error: itemResult.error };
  if (spacesResult.error) return { data: null, error: spacesResult.error };

  type SpaceRow = { id: string; name: string; parent_id: string | null };
  const spaceMap = new Map<string, SpaceRow>(
    (spacesResult.data ?? []).map((s) => [s.id, s])
  );

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

  const items: ItemWithSpace[] = (itemResult.data ?? []).map((row) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const space = (row as any).spaces as { id: string; name: string } | null;
    return {
      ...row,
      tags: row.tags ?? [],
      space: space ?? null,
      space_path: buildPath(space?.id ?? null),
    };
  });

  return { data: items, error: null };
}

/**
 * Creates a new item.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param payload - The item fields to create.
 * @returns The newly created Item.
 */
export async function createItem(
  client: SupabaseClient,
  userId: string,
  payload: CreateItemPayload
): Promise<DbResult<Item>> {
  const { data, error } = await client
    .from("items")
    .insert({ ...payload, user_id: userId, tags: payload.tags ?? [] })
    .select()
    .single();

  if (error) return { data: null, error };
  return { data, error: null };
}

/**
 * Updates an existing item owned by the user.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param itemId - The UUID of the item to update.
 * @param payload - The fields to patch.
 * @returns The updated Item.
 */
export async function updateItem(
  client: SupabaseClient,
  userId: string,
  itemId: string,
  payload: UpdateItemPayload
): Promise<DbResult<Item>> {
  const { data, error } = await client
    .from("items")
    .update(payload)
    .eq("id", itemId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { data: null, error };
  return { data, error: null };
}

/**
 * Deletes an item owned by the user.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param itemId - The UUID of the item to delete.
 */
export async function deleteItem(
  client: SupabaseClient,
  userId: string,
  itemId: string
): Promise<DbResult<null>> {
  const { error } = await client
    .from("items")
    .delete()
    .eq("id", itemId)
    .eq("user_id", userId);

  if (error) return { data: null, error };
  return { data: null, error: null };
}
