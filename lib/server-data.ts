import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import {
  QueryClient,
  defaultShouldDehydrateQuery,
} from "@tanstack/react-query";
import { z } from "zod";
import { ensureDefaultEnvironment } from "@/lib/db/environments";
import { fetchAllTags, fetchItemsBySpace, fetchUnassignedItems } from "@/lib/db/items";
import { fetchSpace, fetchSpaceTree } from "@/lib/db/spaces";
import { ENVIRONMENT_COOKIE, resolveEnvironment } from "@/lib/environment-scope";
import { queryKeys } from "@/lib/query-keys";
import type { DbResult } from "@/lib/types";

/**
 * Server-side data loading for the first render of a page.
 *
 * Pages used to be client components that fetched after hydration, through
 * server actions the browser sends one at a time — so the dashboard's first
 * paint waited on JavaScript, then the environment list, then three queries
 * in series. Now each page starts its queries on the server while it renders
 * and streams them to the browser (see makeServerQueryClient), where the
 * hooks pick them up under the same keys (lib/query-keys.ts).
 */

/**
 * The user's environments for this request, creating the default one if they
 * have none. Cached so the layout and the page share one query.
 */
export const getEnvironments = cache(ensureDefaultEnvironment);

/**
 * The environment the user last selected, as remembered by the cookie.
 *
 * @returns The id, or null when there is no cookie or it isn't a UUID.
 */
export async function getSelectedEnvironmentId(): Promise<string | null> {
  const value = (await cookies()).get(ENVIRONMENT_COOKIE)?.value;
  return z.uuid().safeParse(value).success ? value! : null;
}

/**
 * The environment a page should load data for.
 *
 * Trusts the cookie without checking it against the environment list, so a
 * page can start its queries without waiting for that list. That is safe —
 * every query also filters by the session user, so a forged id finds nothing —
 * and almost always right: EnvironmentProvider rewrites the cookie to the
 * environment it actually shows. When it isn't (the remembered environment was
 * archived elsewhere), the client simply fetches the one it resolves to.
 *
 * @param userId - The session user.
 * @returns The environment id, or null if the user has none.
 */
export async function getScopedEnvironmentId(
  userId: string
): Promise<string | null> {
  const selected = await getSelectedEnvironmentId();
  if (selected) return selected;
  const environments = await getEnvironments(userId);
  if (environments.error) return null;
  return resolveEnvironment(environments.data, null)?.id ?? null;
}

/**
 * A QueryClient for one server render.
 *
 * Queries are dehydrated while still pending: the page doesn't wait for its
 * data, the promises stream to the browser inside the RSC payload, and the
 * client's hooks wait on them rather than fetching again. So a navigation
 * shows the client's cached data at once and freshens it when the stream
 * lands, and a first load has its data in the same response as its HTML.
 */
export function makeServerQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30_000 },
      dehydrate: {
        shouldDehydrateQuery: (query) =>
          defaultShouldDehydrateQuery(query) ||
          query.state.status === "pending",
      },
    },
  });
}

/**
 * Unwraps a data-layer result for a query function. A failure rejects; React
 * Query redacts the message on its way to the browser, and the client's retry
 * then asks the server action, which reports it in full.
 */
async function unwrap<T>(result: Promise<DbResult<T>>): Promise<T> {
  const { data, error } = await result;
  if (error) throw new Error(error.message);
  return data;
}

/** Starts loading an environment's space tree. */
export function prefetchSpaceTree(
  queryClient: QueryClient,
  userId: string,
  environmentId: string
): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.spaces(userId, environmentId),
    queryFn: () => unwrap(fetchSpaceTree(userId, environmentId)),
  });
}

/** Starts loading the items in a space, or the unassigned ones for null. */
export function prefetchItems(
  queryClient: QueryClient,
  userId: string,
  environmentId: string,
  spaceId: string | null
): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.items(userId, environmentId, spaceId),
    queryFn: () =>
      unwrap(
        spaceId === null
          ? fetchUnassignedItems(userId, environmentId)
          : fetchItemsBySpace(userId, environmentId, spaceId)
      ),
  });
}

/** Starts loading an environment's tag list. */
export function prefetchTags(
  queryClient: QueryClient,
  userId: string,
  environmentId: string
): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.tags(userId, environmentId),
    queryFn: () => unwrap(fetchAllTags(userId, environmentId)),
  });
}

/** Starts looking up which environment a space is in. */
export function prefetchSpaceEnvironment(
  queryClient: QueryClient,
  userId: string,
  spaceId: string
): void {
  void queryClient.prefetchQuery({
    queryKey: queryKeys.spaceEnvironment(userId, spaceId),
    queryFn: () => unwrap(fetchSpace(userId, spaceId)),
  });
}
