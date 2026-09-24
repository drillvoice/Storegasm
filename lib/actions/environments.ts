"use server";

/**
 * Server actions for environments.
 *
 * Each action resolves the authenticated user from the Better Auth session —
 * the userId is never accepted from the client — and parses every argument it
 * does accept against lib/validation.ts before it reaches the data layer.
 */

import * as environmentsDb from "@/lib/db/environments";
import { getSessionUserId, NOT_AUTHENTICATED } from "@/lib/session";
import {
  createEnvironmentInput,
  environmentIdInput,
  parseInput,
  updateEnvironmentInput,
} from "@/lib/validation";
import type {
  Environment,
  CreateEnvironmentPayload,
  UpdateEnvironmentPayload,
  DbResult,
} from "@/lib/types";

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
  const input = parseInput(createEnvironmentInput, payload);
  if (input.error) return input;
  return environmentsDb.createEnvironment(userId, input.data);
}

export async function updateEnvironment(
  environmentId: string,
  payload: UpdateEnvironmentPayload
): Promise<DbResult<Environment>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput, environmentId);
  if (envId.error) return envId;
  const input = parseInput(updateEnvironmentInput, payload);
  if (input.error) return input;
  return environmentsDb.updateEnvironment(userId, envId.data, input.data);
}

export async function deleteEnvironment(
  environmentId: string
): Promise<DbResult<null>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput, environmentId);
  if (envId.error) return envId;
  return environmentsDb.deleteEnvironment(userId, envId.data);
}

export async function countEnvironmentContents(
  environmentId: string
): Promise<DbResult<{ spaces: number; items: number }>> {
  const userId = await getSessionUserId();
  if (!userId) return NOT_AUTHENTICATED;
  const envId = parseInput(environmentIdInput, environmentId);
  if (envId.error) return envId;
  return environmentsDb.countEnvironmentContents(userId, envId.data);
}
