"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useEnvironments } from "@/hooks/useEnvironments";
import type { Environment } from "@/lib/types";

const STORAGE_KEY = "sg:env";

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
}

const EnvironmentContext = createContext<EnvironmentContextValue | null>(null);

function readStoredId(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Private-mode browsers can throw on storage access; scope just won't persist.
    return null;
  }
}

/**
 * Holds the environment currently in scope — which house, office or studio the
 * dashboard, search and pickers are showing.
 *
 * The selection is remembered in localStorage so a reload lands you back where
 * you were. It is deliberately not in the URL: every page is scoped, so a
 * query param would have to be threaded through every link.
 *
 * Mounted inside AppShell, beneath the QueryClientProvider, because the
 * environment list is itself a React Query.
 */
export function EnvironmentProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { environments, loading } = useEnvironments();
  const [selectedId, setSelectedId] = useState<string | null>(readStoredId);

  // Resolve the selection against what actually exists: a remembered id can
  // point at an environment that has since been deleted or archived.
  const activeEnvironments = environments.filter((e) => !e.archived_at);
  const environment =
    activeEnvironments.find((e) => e.id === selectedId) ??
    activeEnvironments[0] ??
    environments.find((e) => e.id === selectedId) ??
    environments[0] ??
    null;

  // Persist whatever we settled on — the resolved environment, not the raw
  // selection, so a fallback (the remembered one was archived or deleted)
  // sticks for the next visit too.
  useEffect(() => {
    if (!environment) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, environment.id);
    } catch {
      // Storage unavailable — the selection just won't survive a reload.
    }
  }, [environment]);

  const setEnvironmentId = useCallback((environmentId: string) => {
    setSelectedId(environmentId);
  }, []);

  return (
    <EnvironmentContext.Provider
      value={{
        environments,
        activeEnvironments,
        environment,
        environmentId: environment?.id ?? null,
        setEnvironmentId,
        loading,
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
