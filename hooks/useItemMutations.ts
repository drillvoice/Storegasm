"use client";

import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { deleteItem, updateItem } from "@/lib/actions/items";
import { useUserId } from "@/hooks/useUserId";
import type { ItemWithSpace, UpdateItemPayload } from "@/lib/types";

/**
 * Marks every cache an item change can affect as stale: item lists for any
 * space or environment (an item moved into another environment's space leaves
 * this one), the tag lists, and search results.
 */
export function invalidateItemCaches(
  queryClient: QueryClient,
  userId: string | null
): void {
  queryClient.invalidateQueries({ queryKey: ["items", userId] });
  queryClient.invalidateQueries({ queryKey: ["tags", userId] });
  queryClient.invalidateQueries({ queryKey: ["search", userId] });
}

/**
 * Edits and deletes items from search results.
 *
 * useItems keeps one space's list optimistically in step with its own
 * mutations; search results live in their own caches (one per query), so this
 * patches those instead — the edit or deletion shows at once — then
 * invalidates everything an item change touches, which also brings in the
 * new breadcrumb of an item that moved.
 */
export function useItemMutations() {
  const userId = useUserId();
  const queryClient = useQueryClient();
  const searchKey = ["search", userId];

  function patchSearchResults(
    update: (results: ItemWithSpace[]) => ItemWithSpace[]
  ) {
    queryClient.setQueriesData<ItemWithSpace[]>(
      { queryKey: searchKey },
      (old) => (old ? update(old) : old)
    );
  }

  const editMutation = useMutation({
    mutationFn: async (vars: { itemId: string; payload: UpdateItemPayload }) => {
      const result = await updateItem(vars.itemId, vars.payload);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
    onMutate: async ({ itemId, payload }) => {
      await queryClient.cancelQueries({ queryKey: searchKey });
      // Fields shown on the card update in place; a new location waits for
      // the refetch, which brings the breadcrumb that goes with it.
      const fields = { ...payload };
      delete fields.space_id;
      patchSearchResults((results) =>
        results.map((r) => (r.id === itemId ? { ...r, ...fields } : r))
      );
    },
    onSettled: () => invalidateItemCaches(queryClient, userId),
  });

  const removeMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const result = await deleteItem(itemId);
      if (result.error) throw new Error(result.error.message);
    },
    onMutate: async (itemId) => {
      await queryClient.cancelQueries({ queryKey: searchKey });
      patchSearchResults((results) => results.filter((r) => r.id !== itemId));
    },
    onSettled: () => invalidateItemCaches(queryClient, userId),
  });

  async function editItem(
    itemId: string,
    payload: UpdateItemPayload
  ): Promise<string | null> {
    try {
      await editMutation.mutateAsync({ itemId, payload });
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  async function removeItem(itemId: string): Promise<string | null> {
    try {
      await removeMutation.mutateAsync(itemId);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }

  return { editItem, removeItem };
}
