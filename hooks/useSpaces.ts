"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchSpaceTree,
  createSpace,
  updateSpace,
  deleteSpace,
} from "@/lib/db/spaces";
import type { SpaceNode, CreateSpacePayload, UpdateSpacePayload } from "@/lib/types";

/**
 * Hook for managing the full space tree for the authenticated user.
 *
 * Fetches on mount, exposes CRUD helpers that optimistically refresh the tree
 * after each mutation.
 *
 * @returns The space tree, loading state, any error, and mutation helpers.
 */
export function useSpaces() {
  const [spaces, setSpaces] = useState<SpaceNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const refresh = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const result = await fetchSpaceTree(supabase, user.id);
    if (result.error) {
      setError(result.error.message);
    } else {
      setSpaces(result.data);
      setError(null);
    }
  }, [supabase]);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  /**
   * Creates a new space and refreshes the tree.
   *
   * @param payload - Space creation payload.
   * @returns The error message if creation failed, otherwise null.
   */
  async function addSpace(payload: CreateSpacePayload): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not authenticated";

    const result = await createSpace(supabase, user.id, payload);
    if (result.error) return result.error.message;
    await refresh();
    return null;
  }

  /**
   * Updates an existing space and refreshes the tree.
   *
   * @param spaceId - UUID of the space to update.
   * @param payload - Fields to patch.
   * @returns The error message if the update failed, otherwise null.
   */
  async function editSpace(
    spaceId: string,
    payload: UpdateSpacePayload
  ): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not authenticated";

    const result = await updateSpace(supabase, user.id, spaceId, payload);
    if (result.error) return result.error.message;
    await refresh();
    return null;
  }

  /**
   * Deletes a space (and descendants) and refreshes the tree.
   *
   * @param spaceId - UUID of the space to delete.
   * @returns The error message if deletion failed, otherwise null.
   */
  async function removeSpace(spaceId: string): Promise<string | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not authenticated";

    const result = await deleteSpace(supabase, user.id, spaceId);
    if (result.error) return result.error.message;
    await refresh();
    return null;
  }

  return { spaces, loading, error, refresh, addSpace, editSpace, removeSpace };
}
