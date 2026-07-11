import "server-only";

import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { spaces } from "@/lib/db/schema";
import type {
  Space,
  SpaceNode,
  CreateSpacePayload,
  UpdateSpacePayload,
  DbResult,
} from "@/lib/types";

// Explicit column set so search_vector never leaks into payloads and rows
// match the Space interface exactly.
const spaceColumns = {
  id: spaces.id,
  user_id: spaces.user_id,
  name: spaces.name,
  description: spaces.description,
  parent_id: spaces.parent_id,
  created_at: spaces.created_at,
  updated_at: spaces.updated_at,
};

function toDbError(e: unknown): { data: null; error: { message: string } } {
  return { data: null, error: { message: (e as Error).message } };
}

/**
 * Fetches all spaces for a user and assembles them into a tree.
 *
 * Uses a single flat query then builds the tree in-memory. For typical home
 * storage use cases (< 1 000 spaces) this is faster than a recursive CTE due
 * to round-trip savings.
 *
 * @param userId - The authenticated user's ID.
 * @returns The root-level SpaceNodes with nested children populated.
 */
export async function fetchSpaceTree(
  userId: string
): Promise<DbResult<SpaceNode[]>> {
  let data: Space[];
  try {
    data = await db
      .select(spaceColumns)
      .from(spaces)
      .where(eq(spaces.user_id, userId))
      .orderBy(asc(spaces.name));
  } catch (e) {
    return toDbError(e);
  }

  const map = new Map<string, SpaceNode>();

  for (const space of data) {
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
 * @param userId - The authenticated user's ID.
 * @param spaceId - The UUID of the space to retrieve.
 * @returns The Space record, or null if not found.
 */
export async function fetchSpace(
  userId: string,
  spaceId: string
): Promise<DbResult<Space | null>> {
  try {
    const rows = await db
      .select(spaceColumns)
      .from(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.user_id, userId)))
      .limit(1);
    return { data: rows[0] ?? null, error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Creates a new space.
 *
 * @param userId - The authenticated user's ID.
 * @param payload - The space fields to create.
 * @returns The newly created Space.
 */
export async function createSpace(
  userId: string,
  payload: CreateSpacePayload
): Promise<DbResult<Space>> {
  try {
    const rows = await db
      .insert(spaces)
      .values({ ...payload, user_id: userId })
      .returning(spaceColumns);
    return { data: rows[0], error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Updates an existing space owned by the user.
 *
 * @param userId - The authenticated user's ID.
 * @param spaceId - The UUID of the space to update.
 * @param payload - The fields to patch.
 * @returns The updated Space.
 */
export async function updateSpace(
  userId: string,
  spaceId: string,
  payload: UpdateSpacePayload
): Promise<DbResult<Space>> {
  try {
    const rows = await db
      .update(spaces)
      .set(payload)
      .where(and(eq(spaces.id, spaceId), eq(spaces.user_id, userId)))
      .returning(spaceColumns);
    if (!rows[0]) {
      return { data: null, error: { message: "Space not found" } };
    }
    return { data: rows[0], error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Deletes a space and all of its descendant spaces (cascaded by the DB).
 * Items in deleted spaces have their space_id set to NULL (ON DELETE SET NULL).
 *
 * @param userId - The authenticated user's ID.
 * @param spaceId - The UUID of the space to delete.
 */
export async function deleteSpace(
  userId: string,
  spaceId: string
): Promise<DbResult<null>> {
  try {
    await db
      .delete(spaces)
      .where(and(eq(spaces.id, spaceId), eq(spaces.user_id, userId)));
    return { data: null, error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Fetches the immediate children of a space.
 *
 * @param userId - The authenticated user's ID.
 * @param parentId - The parent space UUID, or null to get root spaces.
 * @returns An array of child Space records.
 */
export async function fetchChildSpaces(
  userId: string,
  parentId: string | null
): Promise<DbResult<Space[]>> {
  try {
    const data = await db
      .select(spaceColumns)
      .from(spaces)
      .where(
        and(
          eq(spaces.user_id, userId),
          parentId === null
            ? isNull(spaces.parent_id)
            : eq(spaces.parent_id, parentId)
        )
      )
      .orderBy(asc(spaces.name));
    return { data, error: null };
  } catch (e) {
    return toDbError(e);
  }
}
