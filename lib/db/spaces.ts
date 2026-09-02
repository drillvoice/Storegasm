import "server-only";

import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { items, spaces } from "@/lib/db/schema";
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
  environment_id: spaces.environment_id,
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
 * Fetches all spaces in one environment and assembles them into a tree.
 *
 * Uses a single flat query then builds the tree in-memory. For typical home
 * storage use cases (< 1 000 spaces) this is faster than a recursive CTE due
 * to round-trip savings.
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The environment to scope to.
 * @returns The root-level SpaceNodes with nested children populated.
 */
export async function fetchSpaceTree(
  userId: string,
  environmentId: string
): Promise<DbResult<SpaceNode[]>> {
  let data: Space[];
  try {
    data = await db
      .select(spaceColumns)
      .from(spaces)
      .where(
        and(
          eq(spaces.user_id, userId),
          eq(spaces.environment_id, environmentId)
        )
      )
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
 * Fetches a single space by ID, from any of the user's environments.
 *
 * Deliberately not environment-scoped: the space detail page uses this to
 * resolve a link into an environment other than the active one (a bookmark
 * followed after a move) so it can switch scope instead of 404ing.
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
 * Creates a new space in an environment.
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The environment the space belongs to.
 * @param payload - The space fields to create.
 * @returns The newly created Space.
 */
export async function createSpace(
  userId: string,
  environmentId: string,
  payload: CreateSpacePayload
): Promise<DbResult<Space>> {
  try {
    if (payload.parent_id) {
      const ok = await parentIsInEnvironment(
        userId,
        payload.parent_id,
        environmentId
      );
      if (!ok) {
        return {
          data: null,
          error: { message: "Parent space is in a different environment" },
        };
      }
    }
    const rows = await db
      .insert(spaces)
      .values({ ...payload, user_id: userId, environment_id: environmentId })
      .returning(spaceColumns);
    return { data: rows[0], error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Updates an existing space owned by the user.
 *
 * Re-parenting within an environment is allowed; pointing a space at a parent
 * in a different environment is not — that is what moveSpaceToEnvironment is
 * for, since it has to carry the whole subtree across.
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
    if (payload.parent_id) {
      const current = await fetchSpace(userId, spaceId);
      if (current.error) return { data: null, error: current.error };
      if (!current.data) {
        return { data: null, error: { message: "Space not found" } };
      }
      const ok = await parentIsInEnvironment(
        userId,
        payload.parent_id,
        current.data.environment_id
      );
      if (!ok) {
        return {
          data: null,
          error: { message: "Parent space is in a different environment" },
        };
      }
    }

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
 * Moves a space, its whole subtree, and every item inside it into another
 * environment — the "this box comes with me to the new house" operation.
 *
 * Done as one statement rather than a transaction: lib/db/client.ts uses the
 * stateless neon-http driver, which has no interactive transactions, but a
 * single statement is atomic on its own. Note that the re-parent and the
 * environment rewrite share one UPDATE on spaces (via the CASE): two
 * data-modifying CTEs touching the same row in one statement would silently
 * drop the second write.
 *
 * @param userId - The authenticated user's ID.
 * @param spaceId - The root of the subtree to move.
 * @param environmentId - The destination environment.
 * @param parentId - The destination parent space, or null for top level.
 */
export async function moveSpaceToEnvironment(
  userId: string,
  spaceId: string,
  environmentId: string,
  parentId: string | null
): Promise<DbResult<null>> {
  try {
    const space = await fetchSpace(userId, spaceId);
    if (space.error) return { data: null, error: space.error };
    if (!space.data) {
      return { data: null, error: { message: "Space not found" } };
    }

    if (parentId) {
      if (parentId === spaceId) {
        return {
          data: null,
          error: { message: "A space cannot be moved into itself" },
        };
      }
      const parent = await fetchSpace(userId, parentId);
      if (parent.error) return { data: null, error: parent.error };
      if (!parent.data || parent.data.environment_id !== environmentId) {
        return {
          data: null,
          error: { message: "Destination space is not in that environment" },
        };
      }
      const inSubtree = await isDescendantOf(userId, parentId, spaceId);
      if (inSubtree) {
        return {
          data: null,
          error: { message: "A space cannot be moved into its own contents" },
        };
      }
    }

    await db.execute(sql`
      WITH RECURSIVE subtree AS (
        SELECT ${spaces.id} FROM ${spaces}
        WHERE ${spaces.id} = ${spaceId} AND ${spaces.user_id} = ${userId}
        UNION ALL
        SELECT s.id FROM ${spaces} s JOIN subtree st ON s.parent_id = st.id
      ),
      moved_spaces AS (
        UPDATE ${spaces} SET
          environment_id = ${environmentId},
          parent_id = CASE
            WHEN ${spaces.id} = ${spaceId} THEN ${parentId}::uuid
            ELSE ${spaces.parent_id}
          END
        WHERE ${spaces.id} IN (SELECT id FROM subtree)
          AND ${spaces.user_id} = ${userId}
        RETURNING ${spaces.id}
      )
      UPDATE ${items} SET environment_id = ${environmentId}
      WHERE ${items.space_id} IN (SELECT id FROM subtree)
        AND ${items.user_id} = ${userId}
    `);

    return { data: null, error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Deletes a space and all of its descendant spaces (cascaded by the DB).
 * Items in deleted spaces have their space_id set to NULL (ON DELETE SET NULL),
 * keeping their environment so they surface in that environment's unassigned
 * bucket rather than vanishing.
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
 * Fetches the immediate children of a space within one environment.
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The environment to scope to.
 * @param parentId - The parent space UUID, or null to get root spaces.
 * @returns An array of child Space records.
 */
export async function fetchChildSpaces(
  userId: string,
  environmentId: string,
  parentId: string | null
): Promise<DbResult<Space[]>> {
  try {
    const data = await db
      .select(spaceColumns)
      .from(spaces)
      .where(
        and(
          eq(spaces.user_id, userId),
          eq(spaces.environment_id, environmentId),
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

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** True when the candidate parent exists, is the user's, and is in `environmentId`. */
async function parentIsInEnvironment(
  userId: string,
  parentId: string,
  environmentId: string
): Promise<boolean> {
  const rows = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(
      and(
        eq(spaces.id, parentId),
        eq(spaces.user_id, userId),
        eq(spaces.environment_id, environmentId)
      )
    )
    .limit(1);
  return !!rows[0];
}

/** True when `candidateId` sits anywhere inside `ancestorId`'s subtree. */
async function isDescendantOf(
  userId: string,
  candidateId: string,
  ancestorId: string
): Promise<boolean> {
  const result = await db.execute<{ id: string }>(sql`
    WITH RECURSIVE subtree AS (
      SELECT ${spaces.id} FROM ${spaces}
      WHERE ${spaces.id} = ${ancestorId} AND ${spaces.user_id} = ${userId}
      UNION ALL
      SELECT s.id FROM ${spaces} s JOIN subtree st ON s.parent_id = st.id
    )
    SELECT id FROM subtree WHERE id = ${candidateId}
  `);
  const rows = Array.isArray(result)
    ? result
    : ((result as { rows?: unknown[] }).rows ?? []);
  return rows.length > 0;
}
