"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchItemsBySpace,
  fetchUnassignedItems,
  createItem,
  updateItem,
  deleteItem,
  searchItems,
} from "@/lib/db/items";
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
 *
 * @param spaceId - The space UUID to fetch items for, or null for unassigned.
 * @returns Items, loading state, error, and mutation helpers.
 */
export function useItems(spaceId: string | null) {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result =
      spaceId === null
        ? await fetchUnassignedItems(supabase, user.id)
        : await fetchItemsBySpace(supabase, user.id, spaceId);

    if (result.error) {
      setError(result.error.message);
    } else {
      setItems(result.data);
      setError(null);
    }
  }, [supabase, spaceId]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  /**
   * Creates a new item and refreshes the list.
   *
   * @param payload - Item creation payload.
   * @returns The error message if creation failed, otherwise null.
   */
  async function addItem(payload: CreateItemPayload): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not authenticated";

    const result = await createItem(supabase, user.id, payload);
    if (result.error) return result.error.message;
    await refresh();
    return null;
  }

  /**
   * Updates an existing item and refreshes the list.
   *
   * @param itemId - UUID of the item to update.
   * @param payload - Fields to patch.
   * @returns The error message if the update failed, otherwise null.
   */
  async function editItem(
    itemId: string,
    payload: UpdateItemPayload
  ): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not authenticated";

    const result = await updateItem(supabase, user.id, itemId, payload);
    if (result.error) return result.error.message;
    await refresh();
    return null;
  }

  /**
   * Deletes an item and refreshes the list.
   *
   * @param itemId - UUID of the item to delete.
   * @returns The error message if deletion failed, otherwise null.
   */
  async function removeItem(itemId: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not authenticated";

    const result = await deleteItem(supabase, user.id, itemId);
    if (result.error) return result.error.message;
    await refresh();
    return null;
  }

  return { items, loading, error, refresh, addItem, editItem, removeItem };
}

/**
 * Hook for full-text searching items across all spaces.
 *
 * Debounces the query by 300 ms before firing to avoid thrashing.
 *
 * @param query - The raw search string.
 * @returns Search results, loading state, and error.
 */
export function useItemSearch(query: string) {
  const [results, setResults] = useState<ItemWithSpace[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const result = await searchItems(supabase, user.id, query);
      if (result.error) {
        setError(result.error.message);
      } else {
        setResults(result.data);
        setError(null);
      }
      setLoading(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, supabase]);

  return { results, loading, error };
}
