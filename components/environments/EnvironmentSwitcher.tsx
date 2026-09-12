"use client";

import { useState } from "react";
import { Check, ChevronsUpDown, House, Plus, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { EnvironmentForm } from "@/components/environments/EnvironmentForm";
import { ManageEnvironmentsDialog } from "@/components/environments/ManageEnvironmentsDialog";
import { useActiveEnvironment } from "@/components/EnvironmentProvider";
import { useEnvironments } from "@/hooks/useEnvironments";
import { cn } from "@/lib/utils";

/**
 * Header control for the place currently in scope.
 *
 * Everything else in the app — the dashboard, the unassigned bucket, search,
 * every space picker — follows this selection, so it lives in the header
 * rather than on any one page.
 */
export function EnvironmentSwitcher() {
  const { environment, activeEnvironments, setEnvironmentId, loading, error } =
    useActiveEnvironment();
  const { addEnvironment } = useEnvironments();

  const [menuOpen, setMenuOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);

  // A new environment is almost always somewhere you want to start filling in,
  // so switch to it once it exists.
  async function handleCreate(values: {
    name: string;
    description: string | null;
  }) {
    const { environment: created, error } = await addEnvironment(values);
    if (error) return error;
    if (created) setEnvironmentId(created.id);
    return null;
  }

  return (
    <>
      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="max-w-[45vw] gap-1.5 px-2 sm:max-w-[220px]"
            aria-label="Switch environment"
          >
            <House className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span
              className={cn("truncate", error && !environment && "text-destructive")}
            >
              {loading && !environment
                ? "…"
                : (environment?.name ??
                  (error ? "Environment unavailable" : "No environment"))}
            </span>
            <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </Button>
        </PopoverTrigger>

        <PopoverContent align="start" className="w-60 p-1">
          {activeEnvironments.map((env) => (
            <button
              key={env.id}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => {
                setEnvironmentId(env.id);
                setMenuOpen(false);
              }}
            >
              <Check
                className={cn(
                  "h-4 w-4 shrink-0",
                  env.id === environment?.id ? "opacity-100" : "opacity-0"
                )}
              />
              <span className="truncate">{env.name}</span>
            </button>
          ))}

          <div className="my-1 h-px bg-border" />

          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              setMenuOpen(false);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4 shrink-0" />
            New environment
          </button>
          <button
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-accent"
            onClick={() => {
              setMenuOpen(false);
              setManageOpen(true);
            }}
          >
            <Settings2 className="h-4 w-4 shrink-0" />
            Manage environments
          </button>
        </PopoverContent>
      </Popover>

      <EnvironmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreate}
      />

      <ManageEnvironmentsDialog
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </>
  );
}
