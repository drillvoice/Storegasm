"use client";

import { useState } from "react";
import { QueryClient } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

const ONE_DAY = 1000 * 60 * 60 * 24;

/**
 * Client-side data provider. Hosts the React Query client and persists its
 * cache to localStorage so return visits render instantly (stale-while-
 * revalidate). The `buster` is the app version, so a deploy invalidates any
 * cache written by an older, possibly-incompatible build.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            gcTime: ONE_DAY,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

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
      {children}
    </PersistQueryClientProvider>
  );
}
