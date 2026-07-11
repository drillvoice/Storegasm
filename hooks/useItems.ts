"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchItemsBySpace,
  fetchUnassignedItems,
  createItem,
  updateItem,
  deleteItem,
  searchItems,
  fetchAllTags,
} from "@/lib/actions/items";
import { useUserId } from "@/hooks/useUserId";
import type {
  Item,
  ItemWithSpace,
  CreateItemPayload,
  UpdateItemPayload,
} from "@/lib/types";

/**
 * Hook for managing items within a specific space.
 *
 * Pass `spaceId: null` to fetch unassigned items.
 */
export function useItems(spaceId: string | null) {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const key = ["items", userId, spaceId ?? "null"];

  const query = useQuery({
    queryKey: key,
    enabled: !!userId,
    queryFn: async () => {
      const result =
        spaceId === null
          ? await fetchUnassignedItems()
          : await fetchItemsBySpace(spaceId);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  function invalidate() {
    // Item lists for other spaces and the tag list may also be affected.
    queryClient.invalidateQueries({ queryKey: ["items", userId] });
    queryClient.invalidateQueries({ queryKey: ["tags", userId] });
  }

  const addMutation = useMutation({
    mutationFn: async (payload: CreateItemPayload) => {
      const result = await createItem(payload);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onMutate: async (payload) => {
      const targetSpace = payload.space_id ?? spaceId;
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Item[]>(key);
      // Only show the new item in this list if it actually belongs here.
      if (targetSpace === spaceId) {
        const now = new Date().toISOString();
        const optimistic: Item = {
          id: `opt-${crypto.randomUUID()}`,
          user_id: userId!,
          name: payload.name,
          description: payload.description ?? null,
          space_id: targetSpace,
          tags: payload.tags ?? [],
          created_at: now,
          updated_at: now,
        };
        queryClient.setQueryData<Item[]>(key, (old) => [
          ...(old ?? []),
          optimistic,
        ]);
      }
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
  });

  const editMutation = useMutation({
    mutationFn: async (vars: { itemId: string; payload: UpdateItemPayload }) => {
      const result = await updateItem(vars.itemId, vars.payload);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Item[]>(key);
      queryClient.setQueryData<Item[]>(key, (old) => {
        const list = old ?? [];
        // Moving the item out of this list's space — drop it.
        if ("space_id" in vars.payload && vars.payload.space_id !== spaceId) {
          return list.filter((i) => i.id !== vars.itemId);
        }
        return list.map((i) =>
          i.id === vars.itemId ? { ...i, ...vars.payload } : i
        );
      });
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
  });

  const removeMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const result = await deleteItem(itemId);
      if (result.error) throw new Error(result.error.message);
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<Item[]>(key);
      queryClient.setQueryData<Item[]>(key, (old) =>
        (old ?? []).filter((i) => i.id !== itemId)
      );
      return { previous };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.previous) queryClient.setQueryData(key, ctx.previous);
    },
    onSettled: invalidate,
  });

  async function addItem(payload: CreateItemPayload): Promise<string | null> {
    if (!userId) return "Not authenticated";
    try {
      await addMutation.mutateAsync(payload);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function editItem(
    itemId: string,
    payload: UpdateItemPayload
  ): Promise<string | null> {
    if (!userId) return "Not authenticated";
    try {
      await editMutation.mutateAsync({ itemId, payload });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function removeItem(itemId: string): Promise<string | null> {
    if (!userId) return "Not authenticated";
    try {
      await removeMutation.mutateAsync(itemId);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function refresh(): Promise<void> {
    await queryClient.invalidateQueries({ queryKey: key });
  }

  return {
    items: query.data ?? [],
    loading: !userId || query.isPending,
    error: query.error ? (query.error as Error).message : null,
    refresh,
    addItem,
    editItem,
    removeItem,
  };
}

/**
 * Hook that returns all distinct tags used across the user's items.
 */
export function useAllTags() {
  const userId = useUserId();

  const query = useQuery({
    queryKey: ["tags", userId],
    enabled: !!userId,
    queryFn: async () => {
      const result = await fetchAllTags();
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  return { tags: query.data ?? [], loading: !userId || query.isPending };
}

/**
 * Hook for full-text searching items across all spaces.
 *
 * Debounces the query by 300 ms before firing to avoid thrashing.
 */
export function useItemSearch(query: string) {
  const userId = useUserId();
  const trimmed = query.trim();
  const [debounced, setDebounced] = useState(trimmed);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(trimmed), 300);
    return () => clearTimeout(timer);
  }, [trimmed]);

  const q = useQuery({
    queryKey: ["search", userId, debounced],
    enabled: !!userId && !!debounced,
    queryFn: async () => {
      const result = await searchItems(debounced);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  if (!trimmed) {
    return { results: [] as ItemWithSpace[], loading: false, error: null };
  }

  return {
    results: q.data ?? [],
    loading: q.isFetching || trimmed !== debounced,
    error: q.error ? (q.error as Error).message : null,
  };
}
