"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEnvironments,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
} from "@/lib/actions/environments";
import { useUserId } from "@/hooks/useUserId";
import { queryKeys } from "@/lib/query-keys";
import type {
  Environment,
  CreateEnvironmentPayload,
  UpdateEnvironmentPayload,
} from "@/lib/types";

interface UseEnvironmentsResult {
  /** Every environment the user has, archived ones included. */
  environments: Environment[];
  loading: boolean;
  error: string | null;
  addEnvironment: (
    payload: CreateEnvironmentPayload
  ) => Promise<{ environment: Environment | null; error: string | null }>;
  editEnvironment: (
    environmentId: string,
    payload: UpdateEnvironmentPayload
  ) => Promise<string | null>;
  removeEnvironment: (environmentId: string) => Promise<string | null>;
}

/**
 * Hook for the user's environments.
 *
 * The server action creates a default environment for an account that has
 * none, so a resolved list is never empty — the rest of the app can rely on
 * having somewhere to put things.
 *
 * Environment changes can move data in and out of scope, so every mutation
 * invalidates the space, item and tag caches as well.
 */
export function useEnvironments(): UseEnvironmentsResult {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const key = queryKeys.environments(userId);

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const result = await fetchEnvironments();
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["environments", userId] });
    queryClient.invalidateQueries({ queryKey: ["spaces", userId] });
    queryClient.invalidateQueries({ queryKey: ["items", userId] });
    queryClient.invalidateQueries({ queryKey: ["tags", userId] });
    queryClient.invalidateQueries({ queryKey: ["search", userId] });
  }

  const addMutation = useMutation({
    mutationFn: async (payload: CreateEnvironmentPayload) => {
      const result = await createEnvironment(payload);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSettled: invalidate,
  });

  const editMutation = useMutation({
    mutationFn: async (vars: {
      environmentId: string;
      payload: UpdateEnvironmentPayload;
    }) => {
      const result = await updateEnvironment(vars.environmentId, vars.payload);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onSettled: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (environmentId: string) => {
      const result = await deleteEnvironment(environmentId);
      if (result.error) throw new Error(result.error.message);
    },
    onSettled: invalidate,
  });

  async function addEnvironment(payload: CreateEnvironmentPayload) {
    if (!userId) return { environment: null, error: "Not authenticated" };
    try {
      const environment = await addMutation.mutateAsync(payload);
      return { environment, error: null };
    } catch (e) {
      return { environment: null, error: (e as Error).message };
    }
  }

  async function editEnvironment(
    environmentId: string,
    payload: UpdateEnvironmentPayload
  ): Promise<string | null> {
    if (!userId) return "Not authenticated";
    try {
      await editMutation.mutateAsync({ environmentId, payload });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function removeEnvironment(
    environmentId: string
  ): Promise<string | null> {
    if (!userId) return "Not authenticated";
    try {
      await removeMutation.mutateAsync(environmentId);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  return {
    environments: query.data ?? [],
    loading: !userId || query.isPending,
    error: query.error ? (query.error as Error).message : null,
    addEnvironment,
    editEnvironment,
    removeEnvironment,
  };
}
