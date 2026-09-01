import "server-only";

import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { environments, items, spaces } from "@/lib/db/schema";
import type {
  Environment,
  CreateEnvironmentPayload,
  UpdateEnvironmentPayload,
  DbResult,
} from "@/lib/types";

// Explicit column set so rows match the Environment interface exactly.
const environmentColumns = {
  id: environments.id,
  user_id: environments.user_id,
  name: environments.name,
  description: environments.description,
  archived_at: environments.archived_at,
  created_at: environments.created_at,
  updated_at: environments.updated_at,
};

function toDbError(e: unknown): { data: null; error: { message: string } } {
  return { data: null, error: { message: (e as Error).message } };
}

/**
 * Fetches every environment belonging to a user, archived ones included.
 *
 * Callers decide what to hide — the switcher shows only active environments,
 * the manage dialog shows all of them.
 *
 * @param userId - The authenticated user's ID.
 * @returns The user's Environments ordered by name.
 */
export async function fetchEnvironments(
  userId: string
): Promise<DbResult<Environment[]>> {
  try {
    const data = await db
      .select(environmentColumns)
      .from(environments)
      .where(eq(environments.user_id, userId))
      .orderBy(asc(environments.name));
    return { data, error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Returns the user's environments, creating a default one if they have none.
 *
 * The 0002 migration gives every account that existed at the time a "My Home"
 * environment. This covers accounts created afterwards: rather than hooking
 * sign-up, the first read creates it. Idempotent — it only inserts when the
 * user genuinely has zero environments.
 *
 * @param userId - The authenticated user's ID.
 * @returns The user's Environments, guaranteed non-empty.
 */
export async function ensureDefaultEnvironment(
  userId: string
): Promise<DbResult<Environment[]>> {
  const existing = await fetchEnvironments(userId);
  if (existing.error) return existing;
  if (existing.data.length > 0) return existing;

  const created = await createEnvironment(userId, { name: "My Home" });
  if (created.error) return { data: null, error: created.error };
  return { data: [created.data], error: null };
}

/**
 * Verifies an environment exists and belongs to the user.
 *
 * Unlike userId, the environment id IS supplied by the client (it is the
 * user's current scope selection), so every action that accepts one calls
 * this first.
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The environment UUID to check.
 * @returns An error result when the environment is not the user's.
 */
export async function assertOwnedEnvironment(
  userId: string,
  environmentId: string
): Promise<{ error: { message: string } | null }> {
  try {
    const rows = await db
      .select({ id: environments.id })
      .from(environments)
      .where(
        and(
          eq(environments.id, environmentId),
          eq(environments.user_id, userId)
        )
      )
      .limit(1);
    if (!rows[0]) return { error: { message: "Environment not found" } };
    return { error: null };
  } catch (e) {
    return { error: { message: (e as Error).message } };
  }
}

/**
 * Creates a new environment.
 *
 * @param userId - The authenticated user's ID.
 * @param payload - The environment fields to create.
 * @returns The newly created Environment.
 */
export async function createEnvironment(
  userId: string,
  payload: CreateEnvironmentPayload
): Promise<DbResult<Environment>> {
  try {
    const rows = await db
      .insert(environments)
      .values({ ...payload, user_id: userId })
      .returning(environmentColumns);
    return { data: rows[0], error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Updates an environment owned by the user — rename, re-describe, or set
 * `archived_at` (null restores it).
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The UUID of the environment to update.
 * @param payload - The fields to patch.
 * @returns The updated Environment.
 */
export async function updateEnvironment(
  userId: string,
  environmentId: string,
  payload: UpdateEnvironmentPayload
): Promise<DbResult<Environment>> {
  try {
    const rows = await db
      .update(environments)
      .set(payload)
      .where(
        and(
          eq(environments.id, environmentId),
          eq(environments.user_id, userId)
        )
      )
      .returning(environmentColumns);
    if (!rows[0]) {
      return { data: null, error: { message: "Environment not found" } };
    }
    return { data: rows[0], error: null };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Counts what deleting an environment would destroy, so the confirmation can
 * say so before the user commits.
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The environment UUID to measure.
 * @returns The number of spaces and items it contains.
 */
export async function countEnvironmentContents(
  userId: string,
  environmentId: string
): Promise<DbResult<{ spaces: number; items: number }>> {
  try {
    const [spaceRows, itemRows] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(spaces)
        .where(
          and(
            eq(spaces.user_id, userId),
            eq(spaces.environment_id, environmentId)
          )
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(items)
        .where(
          and(
            eq(items.user_id, userId),
            eq(items.environment_id, environmentId)
          )
        ),
    ]);
    return {
      data: {
        spaces: spaceRows[0]?.count ?? 0,
        items: itemRows[0]?.count ?? 0,
      },
      error: null,
    };
  } catch (e) {
    return toDbError(e);
  }
}

/**
 * Deletes an environment and everything in it (spaces and items cascade).
 *
 * Refuses to delete the user's last environment — every space and item needs
 * one, so an account with none has nowhere to put anything. Archiving is the
 * non-destructive way to retire a place you no longer use.
 *
 * @param userId - The authenticated user's ID.
 * @param environmentId - The UUID of the environment to delete.
 */
export async function deleteEnvironment(
  userId: string,
  environmentId: string
): Promise<DbResult<null>> {
  try {
    const owned = await db
      .select({ id: environments.id })
      .from(environments)
      .where(eq(environments.user_id, userId));

    if (!owned.some((e) => e.id === environmentId)) {
      return { data: null, error: { message: "Environment not found" } };
    }
    if (owned.length <= 1) {
      return {
        data: null,
        error: {
          message:
            "This is your only environment. Create another one before deleting it.",
        },
      };
    }

    await db
      .delete(environments)
      .where(
        and(
          eq(environments.id, environmentId),
          eq(environments.user_id, userId)
        )
      );
    return { data: null, error: null };
  } catch (e) {
    return toDbError(e);
  }
}
