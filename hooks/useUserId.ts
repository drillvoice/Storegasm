"use client";

import { useQuery } from "@tanstack/react-query";
import { authClient } from "@/lib/auth-client";

/**
 * Resolves the authenticated user's ID once and caches it for the session.
 *
 * Every data query depends on this, so it is cached indefinitely (the user
 * cannot change without a full reload) and shared across all hooks via the
 * QueryClient.
 */
export function useUserId(): string | null {
  const { data } = useQuery({
    queryKey: ["auth", "user"],
    queryFn: async () => {
      const { data: session } = await authClient.getSession();
      return session?.user.id ?? null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data ?? null;
}
