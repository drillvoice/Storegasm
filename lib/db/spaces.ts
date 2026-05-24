import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Space,
  SpaceNode,
  CreateSpacePayload,
  UpdateSpacePayload,
  DbResult,
} from "@/lib/types";

/**
 * Fetches all spaces for a user and assembles them into a tree.
 *
 * Uses a single flat query then builds the tree in-memory. For typical home
 * storage use cases (< 1 000 spaces) this is faster than a recursive CTE due
 * to round-trip savings.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @returns The root-level SpaceNodes with nested children populated.
 */
export async function fetchSpaceTree(
  client: SupabaseClient,
  userId: string
): Promise<DbResult<SpaceNode[]>> {
  const { data, error } = await client
    .from("spaces")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  if (error) return { data: null, error };

  const spaces: Space[] = data ?? [];
  const map = new Map<string, SpaceNode>();

  for (const space of spaces) {
    map.set(space.id, { ...space, children: [] });
  }

  const roots: SpaceNode[] = [];
  for (const node of map.values()) {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return { data: roots, error: null };
}

/**
 * Fetches a single space by ID.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param spaceId - The UUID of the space to retrieve.
 * @returns The Space record, or null if not found.
 */
export async function fetchSpace(
  client: SupabaseClient,
  userId: string,
  spaceId: string
): Promise<DbResult<Space | null>> {
  const { data, error } = await client
    .from("spaces")
    .select("*")
    .eq("id", spaceId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) return { data: null, error };
  return { data: data ?? null, error: null };
}

/**
 * Returns the ordered ancestor chain for a space (breadcrumb).
 *
 * Walks up the parent chain in-memory using the full space list.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param spaceId - The UUID of the target space.
 * @returns An ordered array of Spaces from root to the given space.
 */
export async function fetchSpaceBreadcrumb(
  client: SupabaseClient,
  userId: string,
  spaceId: string
): Promise<DbResult<Space[]>> {
  const { data, error } = await client
    .from("spaces")
    .select("*")
    .eq("user_id", userId);

  if (error) return { data: null, error };

  const map = new Map<string, Space>((data ?? []).map((s) => [s.id, s]));
  const crumbs: Space[] = [];
  let current: Space | undefined = map.get(spaceId);

  while (current) {
    crumbs.unshift(current);
    current = current.parent_id ? map.get(current.parent_id) : undefined;
  }

  return { data: crumbs, error: null };
}

/**
 * Creates a new space.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param payload - The space fields to create.
 * @returns The newly created Space.
 */
export async function createSpace(
  client: SupabaseClient,
  userId: string,
  payload: CreateSpacePayload
): Promise<DbResult<Space>> {
  const { data, error } = await client
    .from("spaces")
    .insert({ ...payload, user_id: userId })
    .select()
    .single();

  if (error) return { data: null, error };
  return { data, error: null };
}

/**
 * Updates an existing space owned by the user.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param spaceId - The UUID of the space to update.
 * @param payload - The fields to patch.
 * @returns The updated Space.
 */
export async function updateSpace(
  client: SupabaseClient,
  userId: string,
  spaceId: string,
  payload: UpdateSpacePayload
): Promise<DbResult<Space>> {
  const { data, error } = await client
    .from("spaces")
    .update(payload)
    .eq("id", spaceId)
    .eq("user_id", userId)
    .select()
    .single();

  if (error) return { data: null, error };
  return { data, error: null };
}

/**
 * Deletes a space and all of its descendant spaces (cascaded by the DB).
 * Items in deleted spaces have their space_id set to NULL (ON DELETE SET NULL).
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param spaceId - The UUID of the space to delete.
 */
export async function deleteSpace(
  client: SupabaseClient,
  userId: string,
  spaceId: string
): Promise<DbResult<null>> {
  const { error } = await client
    .from("spaces")
    .delete()
    .eq("id", spaceId)
    .eq("user_id", userId);

  if (error) return { data: null, error };
  return { data: null, error: null };
}

/**
 * Fetches the immediate children of a space.
 *
 * @param client - An authenticated Supabase client.
 * @param userId - The authenticated user's ID.
 * @param parentId - The parent space UUID, or null to get root spaces.
 * @returns An array of child Space records.
 */
export async function fetchChildSpaces(
  client: SupabaseClient,
  userId: string,
  parentId: string | null
): Promise<DbResult<Space[]>> {
  const query = client
    .from("spaces")
    .select("*")
    .eq("user_id", userId)
    .order("name");

  const { data, error } =
    parentId === null
      ? await query.is("parent_id", null)
      : await query.eq("parent_id", parentId);

  if (error) return { data: null, error };
  return { data: data ?? [], error: null };
}
