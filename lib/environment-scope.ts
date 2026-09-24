import type { Environment } from "@/lib/types";

/**
 * The cookie holding the environment currently in scope.
 *
 * A cookie rather than localStorage so the server knows it too: it is what
 * lets a page start loading the right environment's data before any
 * JavaScript has run.
 */
export const ENVIRONMENT_COOKIE = "sg-env";

/** A year — the selection should outlast any session. */
export const ENVIRONMENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Decides which environment is in scope, given the one the user last selected.
 *
 * A remembered id can point at an environment that has since been archived or
 * deleted, so it only wins while it is still active; otherwise the first
 * active environment does. Archived ones are a last resort, for an account
 * whose every environment is archived.
 *
 * Shared by the server (to prefetch) and EnvironmentProvider (to render), so
 * both settle on the same environment.
 *
 * @param environments - Every environment the user has, archived included.
 * @param selectedId - The remembered selection, if any.
 * @returns The environment in scope, or null when the user has none.
 */
export function resolveEnvironment(
  environments: Environment[],
  selectedId: string | null
): Environment | null {
  const active = environments.filter((e) => !e.archived_at);
  return (
    active.find((e) => e.id === selectedId) ??
    active[0] ??
    environments.find((e) => e.id === selectedId) ??
    environments[0] ??
    null
  );
}
