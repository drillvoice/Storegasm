"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createSpace,
  updateSpace,
  deleteSpace,
  moveSpace,
} from "@/lib/actions/spaces";
import { api } from "@/lib/api/client";
import { useUserId } from "@/hooks/useUserId";
import { useActiveEnvironment } from "@/components/EnvironmentProvider";
import { queryKeys } from "@/lib/query-keys";
import type {
  SpaceNode,
  CreateSpacePayload,
  UpdateSpacePayload,
  MoveSpacePayload,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Tree helpers (pure functions)
// ---------------------------------------------------------------------------

function insertNode(tree: SpaceNode[], node: SpaceNode): SpaceNode[] {
  if (!node.parent_id) return [...tree, node];
  return tree.map((n) => {
    if (n.id === node.parent_id) {
      return {
        ...n,
        children: [...n.children, node].sort((a, b) =>
          a.name.localeCompare(b.name)
        ),
      };
    }
    const updated = insertNode(n.children, node);
    return updated === n.children ? n : { ...n, children: updated };
  });
}

function pruneNode(tree: SpaceNode[], id: string): SpaceNode[] {
  return tree
    .filter((n) => n.id !== id)
    .map((n) => {
      const updated = pruneNode(n.children, id);
      return updated === n.children ? n : { ...n, children: updated };
    });
}

// Applies a patch to a node AND moves it to its new parent if parent_id changed.
function relocateNode(
  tree: SpaceNode[],
  id: string,
  patch: Partial<SpaceNode>
): SpaceNode[] {
  let target: SpaceNode | null = null;
  const search = (nodes: SpaceNode[]) => {
    for (const n of nodes) {
      if (n.id === id) {
        target = n;
        return;
      }
      search(n.children);
    }
  };
  search(tree);
  if (!target) return tree;
  const patched: SpaceNode = { ...(target as SpaceNode), ...patch };
  return insertNode(pruneNode(tree, id), patched);
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

interface UseSpacesResult {
  spaces: SpaceNode[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addSpace: (payload: CreateSpacePayload) => Promise<string | null>;
  editSpace: (
    spaceId: string,
    payload: UpdateSpacePayload
  ) => Promise<string | null>;
  moveSpaceTo: (
    spaceId: string,
    payload: MoveSpacePayload
  ) => Promise<string | null>;
  removeSpace: (spaceId: string) => Promise<string | null>;
}

/**
 * Hook for the space tree of the environment currently in scope.
 *
 * Trees from different environments are cached separately (the environment id
 * is part of the query key), so switching between a house and a workplace is
 * instant after the first visit to each.
 */
export function useSpaces(): UseSpacesResult {
  const userId = useUserId();
  const { environmentId } = useActiveEnvironment();
  const queryClient = useQueryClient();
  const key = queryKeys.spaces(userId, environmentId);

  const query = useQuery({
    queryKey: key,
    enabled: !!userId && !!environmentId,
    queryFn: () => api.spaceTree(environmentId!),
  });

  const addMutation = useMutation({
    mutationFn: async (payload: CreateSpacePayload) => {
      const result = await createSpace(environmentId!, payload);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SpaceNode[]>(key);
      const now = new Date().toISOString();
      const optimistic: SpaceNode = {
        id: `opt-${crypto.randomUUID()}`,
        user_id: userId!,
        environment_id: environmentId!,
        name: payload.name,
        description: payload.description ?? null,
        parent_id: payload.parent_id ?? null,
        created_at: now,
        updated_at: now,
        children: [],
      };
      queryClient.setQueryData<SpaceNode[]>(key, (old) =>
        insertNode(old ?? [], optimistic)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces", userId] });
    },
  });

  const editMutation = useMutation({
    mutationFn: async (vars: { spaceId: string; payload: UpdateSpacePayload }) => {
      const result = await updateSpace(vars.spaceId, vars.payload);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SpaceNode[]>(key);
      queryClient.setQueryData<SpaceNode[]>(key, (old) =>
        relocateNode(old ?? [], vars.spaceId, vars.payload)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["spaces", userId] });
    },
  });

  // Moving a space to another environment takes its whole subtree and every
  // item inside it. Optimistically it just disappears from this tree; the
  // destination tree is refetched.
  const moveMutation = useMutation({
    mutationFn: async (vars: { spaceId: string; payload: MoveSpacePayload }) => {
      const result = await moveSpace(vars.spaceId, vars.payload);
      if (result.error) throw new Error(result.error.message);
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SpaceNode[]>(key);
      if (vars.payload.environment_id !== environmentId) {
        queryClient.setQueryData<SpaceNode[]>(key, (old) =>
          pruneNode(old ?? [], vars.spaceId)
        );
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      // Both the source and destination environments changed, so invalidate
      // by prefix rather than for this environment alone.
      queryClient.invalidateQueries({ queryKey: ["spaces", userId] });
      queryClient.invalidateQueries({ queryKey: ["items", userId] });
      queryClient.invalidateQueries({ queryKey: ["tags", userId] });
      queryClient.invalidateQueries({ queryKey: ["search", userId] });
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (spaceId: string) => {
      const result = await deleteSpace(spaceId);
      if (result.error) throw new Error(result.error.message);
    },
    onMutate: async (spaceId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<SpaceNode[]>(key);
      queryClient.setQueryData<SpaceNode[]>(key, (old) =>
        pruneNode(old ?? [], spaceId)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: () => {
      // Deleting a space orphans its items (space_id → null), so both queries
      // may be stale.
      queryClient.invalidateQueries({ queryKey: ["spaces", userId] });
      queryClient.invalidateQueries({ queryKey: ["items", userId] });
    },
  });

  async function addSpace(payload: CreateSpacePayload): Promise<string | null> {
    if (!userId) return "Not authenticated";
    try {
      await addMutation.mutateAsync(payload);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function editSpace(
    spaceId: string,
    payload: UpdateSpacePayload
  ): Promise<string | null> {
    if (!userId) return "Not authenticated";
    try {
      await editMutation.mutateAsync({ spaceId, payload });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function moveSpaceTo(
    spaceId: string,
    payload: MoveSpacePayload
  ): Promise<string | null> {
    if (!userId) return "Not authenticated";
    try {
      await moveMutation.mutateAsync({ spaceId, payload });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function removeSpace(spaceId: string): Promise<string | null> {
    if (!userId) return "Not authenticated";
    try {
      await removeMutation.mutateAsync(spaceId);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: key });
  }

  return {
    spaces: query.data ?? [],
    loading: !userId || !environmentId || query.isPending,
    error: query.error ? (query.error as Error).message : null,
    refresh,
    addSpace,
    editSpace,
    moveSpaceTo,
    removeSpace,
  };
}
