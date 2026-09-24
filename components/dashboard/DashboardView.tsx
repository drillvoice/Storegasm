"use client";

import { Plus } from "lucide-react";
import { useSpaces } from "@/hooks/useSpaces";
import { useItems, useAllTags } from "@/hooks/useItems";
import { useActiveEnvironment } from "@/components/EnvironmentProvider";
import { SpaceTreemap } from "@/components/spaces/SpaceTreemap";
import { ItemCard } from "@/components/items/ItemCard";
import {
  WorkspaceDialogs,
  useWorkspace,
} from "@/components/workspace/WorkspaceDialogs";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

/**
 * Dashboard — the space tree and unassigned items of the environment
 * currently in scope. app/(app)/dashboard/page.tsx starts its queries on the
 * server; the hooks here pick them up.
 *
 * All mutations go through the useSpaces and useItems hooks which handle
 * refresh after each change.
 */
export function DashboardView() {
  const { environment, error: environmentError } = useActiveEnvironment();
  const { spaces, loading, addSpace, editSpace, moveSpaceTo, removeSpace } =
    useSpaces();
  const { items: unassigned, addItem, editItem, removeItem } = useItems(null);
  const { tags } = useAllTags();
  const workspace = useWorkspace({
    spaces,
    tags,
    addSpace,
    editSpace,
    moveSpaceTo,
    removeSpace,
    addItem,
    editItem,
    removeItem,
  });

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">
          {environment?.name ?? "Your spaces"}
        </h1>
        <Button onClick={() => workspace.openAddSpace(null)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add space
        </Button>
      </div>

      {environmentError ? (
        // Without an environment nothing below can be scoped, so say what went
        // wrong instead of showing an empty tree or a spinner that never ends.
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4">
          <p className="font-medium">Couldn&apos;t load your environments</p>
          <p className="mt-1 text-sm text-muted-foreground">{environmentError}</p>
        </div>
      ) : loading ? (
        <div className="flex items-center justify-center py-24">
          <p className="text-muted-foreground animate-pulse">Loading…</p>
        </div>
      ) : (
        <>
          <SpaceTreemap
            spaces={spaces}
            onAddRoot={() => workspace.openAddSpace(null)}
            onAddChild={workspace.openAddSpace}
            onEdit={workspace.openEditSpace}
            onMove={workspace.openMoveSpace}
            onDelete={workspace.deleteSpace}
          />

          {unassigned.length > 0 && (
            <>
              <Separator />
              <section>
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Unassigned items</h2>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {unassigned.map((item) => (
                    <ItemCard
                      key={item.id}
                      item={item}
                      onEdit={workspace.openEditItem}
                      onMove={workspace.openMoveItem}
                      onDelete={workspace.deleteItem}
                    />
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      <div className="fixed bottom-6 right-6">
        <Button onClick={workspace.openAddItem} size="lg" className="rounded-full shadow-lg">
          <Plus className="mr-2 h-5 w-5" />
          Add item
        </Button>
      </div>

      <WorkspaceDialogs workspace={workspace} />
    </div>
  );
}
