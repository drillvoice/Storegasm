"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  fetchSpaceTree,
  createSpace,
  updateSpace,
  deleteSpace,
} from "@/lib/db/spaces";
import type { SpaceNode, CreateSpacePayload, UpdateSpacePayload } from "@/lib/types";

// ---------------------------------------------------------------------------
// Tree helpers (pure functions)
// ---------------------------------------------------------------------------

function insertNode(tree: SpaceNode[], node: SpaceNode): SpaceNode[] {
  if (!node.parent_id) return [...tree, node];
  return tree.map((n) => {
    if (n.id === node.parent_id) {
      return { ...n, children: [...n.children, node].sort((a, b) => a.name.localeCompare(b.name)) };
    }
    const updated = insertNode(n.children, node);
    return updated === n.children ? n : { ...n, children: updated };
  });
}

function patchNode(
  tree: SpaceNode[],
  id: string,
  patch: Partial<SpaceNode>
): SpaceNode[] {
  return tree.map((n) => {
    if (n.id === id) return { ...n, ...patch };
    const updated = patchNode(n.children, id, patch);
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

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface SpacesContextValue {
  spaces: SpaceNode[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  addSpace: (payload: CreateSpacePayload) => Promise<string | null>;
  editSpace: (spaceId: string, payload: UpdateSpacePayload) => Promise<string | null>;
  removeSpace: (spaceId: string) => Promise<string | null>;
}

const SpacesContext = createContext<SpacesContextValue | null>(null);

export function SpacesProvider({ children }: { children: React.ReactNode }) {
  const [spaces, setSpaces] = useState<SpaceNode[]>([]);
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
    const result = await fetchSpaceTree(supabase, userId);
    if (result.error) {
      setError(result.error.message);
    } else {
      setSpaces(result.data);
      setError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  async function addSpace(payload: CreateSpacePayload): Promise<string | null> {
    const userId = await getUserId();
    if (!userId) return "Not authenticated";

    const now = new Date().toISOString();
    const tempId = `opt-${Date.now()}`;
    const optimistic: SpaceNode = {
      id: tempId,
      user_id: userId,
      name: payload.name,
      description: payload.description ?? null,
      parent_id: payload.parent_id ?? null,
      created_at: now,
      updated_at: now,
      children: [],
    };
    setSpaces((prev) => insertNode(prev, optimistic));

    const result = await createSpace(supabase, userId, payload);
    if (result.error) {
      setSpaces((prev) => pruneNode(prev, tempId));
      return result.error.message;
    }
    setSpaces((prev) =>
      insertNode(pruneNode(prev, tempId), { ...result.data, children: [] })
    );
    return null;
  }

  async function editSpace(
    spaceId: string,
    payload: UpdateSpacePayload
  ): Promise<string | null> {
    const userId = await getUserId();
    if (!userId) return "Not authenticated";

    const snapshot = spaces;
    setSpaces((prev) => patchNode(prev, spaceId, payload));

    const result = await updateSpace(supabase, userId, spaceId, payload);
    if (result.error) {
      setSpaces(snapshot);
      return result.error.message;
    }
    return null;
  }

  async function removeSpace(spaceId: string): Promise<string | null> {
    const userId = await getUserId();
    if (!userId) return "Not authenticated";

    const snapshot = spaces;
    setSpaces((prev) => pruneNode(prev, spaceId));

    const result = await deleteSpace(supabase, userId, spaceId);
    if (result.error) {
      setSpaces(snapshot);
      return result.error.message;
    }
    return null;
  }

  return (
    <SpacesContext.Provider
      value={{ spaces, loading, error, refresh, addSpace, editSpace, removeSpace }}
    >
      {children}
    </SpacesContext.Provider>
  );
}

export function useSpaces(): SpacesContextValue {
  const ctx = useContext(SpacesContext);
  if (!ctx) throw new Error("useSpaces must be used within SpacesProvider");
  return ctx;
}
