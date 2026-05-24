"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
  const userIdRef = useRef<string | null>(null);

  const supabase = createClient();

  async function getUserId(): Promise<string | null> {
    if (userIdRef.current) return userIdRef.current;
    const { data: { user } } = await supabase.auth.getUser();
    userIdRef.current = user?.id ?? null;
    return userIdRef.current;
  }

  const refresh = useCallback(async () => {
    const userId = await getUserId();
    if (!userId) return;

    const result =
      spaceId === null
        ? await fetchUnassignedItems(supabase, userId)
        : await fetchItemsBySpace(supabase, userId, spaceId);

    if (result.error) {
      setError(result.error.message);
    } else {
      setItems(result.data);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spaceId]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function addItem(payload: CreateItemPayload): Promise<string | null> {
    const userId = await getUserId();
    if (!userId) return "Not authenticated";

    const now = new Date().toISOString();
    const tempId = `opt-${Date.now()}`;
    const optimistic: Item = {
      id: tempId,
      user_id: userId,
      name: payload.name,
      description: payload.description ?? null,
      space_id: payload.space_id ?? spaceId,
      tags: payload.tags ?? [],
      created_at: now,
      updated_at: now,
    };
    setItems((prev) => [...prev, optimistic]);

    const result = await createItem(supabase, userId, payload);
    if (result.error) {
      setItems((prev) => prev.filter((i) => i.id !== tempId));
      return result.error.message;
    }
    setItems((prev) => prev.map((i) => (i.id === tempId ? result.data : i)));
    return null;
  }

  async function editItem(
    itemId: string,
    payload: UpdateItemPayload
  ): Promise<string | null> {
    const userId = await getUserId();
    if (!userId) return "Not authenticated";

    const snapshot = items;
    setItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, ...payload } : i))
    );

    const result = await updateItem(supabase, userId, itemId, payload);
    if (result.error) {
      setItems(snapshot);
      return result.error.message;
    }
    return null;
  }

  async function removeItem(itemId: string): Promise<string | null> {
    const userId = await getUserId();
    if (!userId) return "Not authenticated";

    const snapshot = items;
    setItems((prev) => prev.filter((i) => i.id !== itemId));

    const result = await deleteItem(supabase, userId, itemId);
    if (result.error) {
      setItems(snapshot);
      return result.error.message;
    }
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
