"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useEnvironments } from "@/hooks/useEnvironments";
import {
  ENVIRONMENT_COOKIE,
  ENVIRONMENT_COOKIE_MAX_AGE,
  resolveEnvironment,
} from "@/lib/environment-scope";
import type { Environment } from "@/lib/types";

/**
 * Where the selection lived before it moved to a cookie. Read once, to carry
 * an existing user's choice across, then removed.
 */
const LEGACY_STORAGE_KEY = "sg:env";

interface EnvironmentContextValue {
  /** Every environment the user has, archived ones included. */
  environments: Environment[];
  /** Just the ones that haven't been archived — what the switcher offers. */
  activeEnvironments: Environment[];
  /** The environment currently in scope, or null while still loading. */
  environment: Environment | null;
  environmentId: string | null;
  setEnvironmentId: (environmentId: string) => void;
  loading: boolean;
  /**
   * Why the environment list could not be loaded, if it could not be. Nothing
   * downstream can be scoped without it, so pages show this rather than an
   * empty dashboard or a spinner that never resolves.
   */
  error: string | null;
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null);

function writeCookie(environmentId: string) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie =
    `${ENVIRONMENT_COOKIE}=${environmentId}; path=/; ` +
    `max-age=${ENVIRONMENT_COOKIE_MAX_AGE}; samesite=lax${secure}`;
}

/**
 * Holds the environment currently in scope — which house, office or studio the
 * dashboard, search and pickers are showing.
 *
 * The selection is remembered in a cookie so a reload lands you back where
 * you were, and so the server can load that environment's data before the
 * page reaches the browser. It is deliberately not in the URL: every page is
 * scoped, so a query param would have to be threaded through every link.
 *
 * Mounted inside AppShell, beneath the QueryClientProvider, because the
 * environment list is itself a React Query.
 *
 * @param initialEnvironmentId - The selection the server read from the
 *   cookie, or null if there was none.
 */
export function EnvironmentProvider({
  initialEnvironmentId,
  children,
}: {
  initialEnvironmentId: string | null;
  children: React.ReactNode;
}) {
  const { environments, loading, error } = useEnvironments();
  const [selectedId, setSelectedId] = useState<string | null>(
    initialEnvironmentId
  );

  // Carry over a selection remembered by a build that kept it in
  // localStorage. Done after mount, not in the initial state, so the first
  // client render matches the server's.
  useEffect(() => {
    try {
      const legacy = window.localStorage.getItem(LEGACY_STORAGE_KEY);
      if (legacy === null) return;
      window.localStorage.removeItem(LEGACY_STORAGE_KEY);
      // A one-off read of an external store on mount; it can't be initial
      // state because the server, which has no localStorage, rendered first.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (initialEnvironmentId === null) setSelectedId(legacy);
    } catch {
      // Storage unavailable — there is nothing to carry over.
    }
  }, [initialEnvironmentId]);

  // Resolve the selection against what actually exists: a remembered id can
  // point at an environment that has since been deleted or archived.
  const activeEnvironments = environments.filter((e) => !e.archived_at);
  const environment = resolveEnvironment(environments, selectedId);

  // Persist whatever we settled on — the resolved environment, not the raw
  // selection, so a fallback (the remembered one was archived or deleted)
  // sticks for the next visit too, and the server loads what is shown.
  const resolvedId = environment?.id ?? null;
  useEffect(() => {
    if (resolvedId) writeCookie(resolvedId);
  }, [resolvedId]);

  const setEnvironmentId = useCallback((environmentId: string) => {
    setSelectedId(environmentId);
  }, []);

  return (
    <EnvironmentContext.Provider
      value={{
        environments,
        activeEnvironments,
        environment,
        environmentId: resolvedId,
        setEnvironmentId,
        loading,
        error,
      }}
    >
      {children}
    </EnvironmentContext.Provider>
  );
}

/**
 * Reads the environment currently in scope.
 *
 * Every data hook gates on `environmentId` being non-null, so queries wait for
 * the environment list rather than firing unscoped.
 */
export function useActiveEnvironment(): EnvironmentContextValue {
  const ctx = useContext(EnvironmentContext);
  if (!ctx) {
    throw new Error(
      "useActiveEnvironment must be used inside an EnvironmentProvider"
    );
  }
  return ctx;
}
