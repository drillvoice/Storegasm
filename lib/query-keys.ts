/**
 * React Query keys shared by the client hooks and the server prefetches.
 *
 * The server starts a page's queries under exactly these keys and streams them
 * to the browser, where the hooks pick them up instead of fetching again — so
 * both sides must build them identically. Each key begins
 * [kind, userId, …], which is the prefix the hooks invalidate by.
 */
export const queryKeys = {
  environments: (userId: string | null) => ["environments", userId] as const,
  spaces: (userId: string | null, environmentId: string | null) =>
    ["spaces", userId, environmentId] as const,
  /** A null spaceId is the environment's unassigned items. */
  items: (
    userId: string | null,
    environmentId: string | null,
    spaceId: string | null
  ) => ["items", userId, environmentId, spaceId ?? "null"] as const,
  tags: (userId: string | null, environmentId: string | null) =>
    ["tags", userId, environmentId] as const,
  /** Which environment a space is in — the space page's cross-environment lookup. */
  spaceEnvironment: (userId: string | null, spaceId: string) =>
    ["space-environment", userId, spaceId] as const,
};
