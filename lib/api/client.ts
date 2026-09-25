import type {
  Environment,
  Item,
  ItemWithSpace,
  Space,
  SpaceNode,
} from "@/lib/types";

/**
 * Client-side reads, over the GET routes in app/api/.
 *
 * These replace the read-only server actions: the browser sends server
 * actions one at a time, so a page's reads queued behind each other, where
 * these run in parallel. Each resolves to the data or throws with the
 * server's message, which is what a React Query queryFn wants.
 */

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path, { headers: { accept: "application/json" } });
  let body: { data: T; error: { message: string } | null } | null = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON — a proxy error page, say. Reported below by status.
  }
  if (!response.ok || !body || body.error) {
    throw new Error(
      body?.error?.message ?? `Request failed (${response.status})`
    );
  }
  return body.data;
}

const enc = encodeURIComponent;

export const api = {
  /** Every environment the user has, archived ones included. */
  environments: () => getJson<Environment[]>("/api/environments"),

  spaceTree: (environmentId: string) =>
    getJson<SpaceNode[]>(`/api/environments/${enc(environmentId)}/spaces`),

  /** Items in `spaceId`, or the environment's unassigned items for null. */
  items: (environmentId: string, spaceId: string | null) =>
    getJson<Item[]>(
      `/api/environments/${enc(environmentId)}/items` +
        (spaceId === null ? "" : `?space=${enc(spaceId)}`)
    ),

  tags: (environmentId: string) =>
    getJson<string[]>(`/api/environments/${enc(environmentId)}/tags`),

  environmentContents: (environmentId: string) =>
    getJson<{ spaces: number; items: number }>(
      `/api/environments/${enc(environmentId)}/contents`
    ),

  /** A space from any of the user's environments, or null if there's none. */
  space: (spaceId: string) =>
    getJson<Space | null>(`/api/spaces/${enc(spaceId)}`),

  /** Pass a null environmentId to search every environment. */
  search: (environmentId: string | null, query: string) =>
    getJson<ItemWithSpace[]>(
      `/api/search?q=${enc(query)}` +
        (environmentId ? `&environment=${enc(environmentId)}` : "")
    ),
};
