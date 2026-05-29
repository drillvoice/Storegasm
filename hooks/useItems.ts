"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchItemsBySpace,
  fetchUnassignedItems,
  createItem,
  updateItem,
  deleteItem,
  searchItems,
  fetchAllTags,
} from "@/lib/db/items";
import { readCache, writeCache } from "@/lib/cache";
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
  const supabase = useMemo(() => createClient(), []);

  const getUserId = useCallback(async (): Promise<string | null> => {
    if (userIdRef.current) return userIdRef.current;
    const { data: { user } } = await supabase.auth.getUser();
    userIdRef.current = user?.id ?? null;
    return userIdRef.current;
  }, [supabase]);

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
  }, [spaceId, supabase, getUserId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const userId = await getUserId();
      if (!userId || cancelled) { setLoading(false); return; }

      // Render from cache immediately — no spinner on return visits.
      const cacheKey = `${userId}:items:${spaceId ?? 'null'}`;
      const cached = readCache<Item[]>(cacheKey);
      if (cached !== null && !cancelled) {
        setItems(cached);
        setLoading(false);
      }

      // Revalidate from network in the background.
      await refresh();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [refresh, getUserId, spaceId]);

  // Write through to the cache whenever the list changes (initial load,
  // revalidation, or an optimistic mutation) so return visits stay fresh.
  useEffect(() => {
    if (loading) return;
    const userId = userIdRef.current;
    if (userId) writeCache(`${userId}:items:${spaceId ?? 'null'}`, items);
  }, [items, spaceId, loading]);

  async function addItem(payload: CreateItemPayload): Promise<string | null> {
    const userId = await getUserId();
    if (!userId) return "Not authenticated";

    const now = new Date().toISOString();
    const tempId = `opt-${crypto.randomUUID()}`;
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
    setItems((prev) => {
      // Moving the item out of this list's space — drop it so it doesn't
      // linger in the wrong place until the next revalidation.
      if ("space_id" in payload && payload.space_id !== spaceId) {
        return prev.filter((i) => i.id !== itemId);
      }
      return prev.map((i) => (i.id === itemId ? { ...i, ...payload } : i));
    });

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
 * Hook that returns all distinct tags used across the user's items.
 *
 * Fetches once on mount; returns a sorted, deduplicated list.
 *
 * @returns All existing tags, loading state, and error.
 */
export function useAllTags() {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const cacheKey = `${user.id}:tags`;
      const cached = readCache<string[]>(cacheKey);
      if (cached !== null) {
        setTags(cached);
        setLoading(false);
      }

      const result = await fetchAllTags(supabase, user.id);
      if (result.data) {
        setTags(result.data);
        writeCache(cacheKey, result.data);
      }
      setLoading(false);
    })();
  }, [supabase]);

  return { tags, loading };
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

  const supabase = useMemo(() => createClient(), []);

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
