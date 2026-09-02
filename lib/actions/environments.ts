"use server";

/**
 * Server actions for environments.
 *
 * Each action resolves the authenticated user from the Better Auth session —
 * the userId is never accepted from the client. This is the app-level
 * replacement for the RLS policies the schema had on Supabase.
 */

import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import * as environmentsDb from "@/lib/db/environments";
import type {
  Environment,
  CreateEnvironmentPayload,
  UpdateEnvironmentPayload,
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

/**
 * Returns the user's environments, creating a default one if they have none,
 * so the client always has a scope to work in.
 */
export async function fetchEnvironments(): Promise<DbResult<Environment[]>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return environmentsDb.ensureDefaultEnvironment(userId);
}

export async function createEnvironment(
  payload: CreateEnvironmentPayload
): Promise<DbResult<Environment>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return environmentsDb.createEnvironment(userId, payload);
}

export async function updateEnvironment(
  environmentId: string,
  payload: UpdateEnvironmentPayload
): Promise<DbResult<Environment>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return environmentsDb.updateEnvironment(userId, environmentId, payload);
}

export async function deleteEnvironment(
  environmentId: string
): Promise<DbResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return environmentsDb.deleteEnvironment(userId, environmentId);
}

export async function countEnvironmentContents(
  environmentId: string
): Promise<DbResult<{ spaces: number; items: number }>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  return environmentsDb.countEnvironmentContents(userId, environmentId);
}
