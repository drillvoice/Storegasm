"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { EnvironmentProvider } from "@/components/EnvironmentProvider";
import { UserIdProvider } from "@/hooks/useUserId";
import { queryKeys } from "@/lib/query-keys";
import type { Environment } from "@/lib/types";

const ONE_DAY = 1000 * 60 * 60 * 24;

/**
 * Client-side data provider. Hosts the React Query client and persists its
 * cache to localStorage so return visits render instantly (stale-while-
 * revalidate). The `buster` is the app version, so a deploy invalidates any
 * cache written by an older, possibly-incompatible build.
 *
 * EnvironmentProvider sits inside it, since the environment list — which
 * decides what everything else is scoped to — is itself a query. The (app)
 * layout loads that list on the server and it is seeded into the cache here,
 * so the header and the scope are right in the server-rendered HTML rather
 * than appearing after a round trip.
 *
 * @param userId - The session user, resolved server-side by the (app) layout.
 * @param initialEnvironments - The user's environments, or null if the server
 *   couldn't load them (the client then fetches, and reports why it failed).
 * @param initialEnvironmentId - The remembered selection, read by the server
 *   from the selection cookie.
 */
export function AppShell({
  userId,
  initialEnvironments,
  initialEnvironmentId,
  children,
}: {
  userId: string;
  initialEnvironments: Environment[] | null;
  initialEnvironmentId: string | null;
  children: React.ReactNode;
}) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: (query) =>
            // Data the server streamed in (lib/server-data.ts) that had
            // already arrived by hydration is stored with dataUpdatedAt 0,
            // which would make it stale on sight and refetch everything the
            // page just rendered. The server sends it fresh on every
            // navigation and mutations invalidate it, so treat it as fresh.
            query.state.dataUpdatedAt === 0 && query.state.data !== undefined
              ? Infinity
              : 30_000,
          gcTime: ONE_DAY,
          refetchOnWindowFocus: false,
          retry: 1,
        },
      },
    });
    if (initialEnvironments) {
      client.setQueryData(queryKeys.environments(userId), initialEnvironments);
    }
    return client;
  });

  const [persister] = useState(() =>
    createSyncStoragePersister({
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      key: "sg:rq",
    })
  );

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        maxAge: ONE_DAY,
        buster: process.env.NEXT_PUBLIC_APP_VERSION ?? "dev",
      }}
    >
      <UserIdProvider userId={userId}>
        <EnvironmentProvider initialEnvironmentId={initialEnvironmentId}>
          {children}
        </EnvironmentProvider>
      </UserIdProvider>
    </PersistQueryClientProvider>
  );
}
