"use client";

import { SpacesProvider } from "@/contexts/SpacesContext";

export function AppShell({ children }: { children: React.ReactNode }) {
  return <SpacesProvider>{children}</SpacesProvider>;
}
