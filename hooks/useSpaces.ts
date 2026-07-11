"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSpaceTree,
  createSpace,
  updateSpace,
  deleteSpace,
} from "@/lib/actions/spaces";
import { useUserId } from "@/hooks/useUserId";
import type {
  SpaceNode,
  CreateSpacePayload,
  UpdateSpacePayload,
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
  removeSpace: (spaceId: string) => Promise<string | null>;
}

export function useSpaces(): UseSpacesResult {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const key = ["spaces", userId];

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const result = await fetchSpaceTree();
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  const addMutation = useMutation({
    mutationFn: async (payload: CreateSpacePayload) => {
      const result = await createSpace(payload);
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
    await queryClient.invalidateQueries({ queryKey: ["spaces", userId] });
  }

  return {
    spaces: query.data ?? [],
    loading: !userId || query.isPending,
    error: query.error ? (query.error as Error).message : null,
    refresh,
    addSpace,
    editSpace,
    removeSpace,
  };
}
