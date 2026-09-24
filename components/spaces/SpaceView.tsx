"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Plus, ChevronRight, Home } from "lucide-react";
import { useSpaces } from "@/hooks/useSpaces";
import { useItems, useAllTags } from "@/hooks/useItems";
import { useUserId } from "@/hooks/useUserId";
import { useActiveEnvironment } from "@/components/EnvironmentProvider";
import { SpaceTreemap } from "@/components/spaces/SpaceTreemap";
import { ItemCard } from "@/components/items/ItemCard";
import {
  WorkspaceDialogs,
  useWorkspace,
} from "@/components/workspace/WorkspaceDialogs";
import { fetchSpace } from "@/lib/actions/spaces";
import { queryKeys } from "@/lib/query-keys";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SpaceNode } from "@/lib/types";

/** The path from a root down to `targetId`, or [] if it isn't in the tree. */
function findPath(nodes: SpaceNode[], targetId: string): SpaceNode[] {
  for (const node of nodes) {
    if (node.id === targetId) return [node];
    const below = findPath(node.children, targetId);
    if (below.length) return [node, ...below];
  }
  return [];
}

/**
 * Space detail — the breadcrumb, child spaces, and items for a single space.
 * app/(app)/spaces/[id]/page.tsx starts its queries on the server; the hooks
 * here pick them up.
 *
 * @param id - The space's id, from the URL.
 */
export function SpaceView({ id }: { id: string }) {
  const userId = useUserId();
  const { environmentId, setEnvironmentId } = useActiveEnvironment();
  const {
    spaces,
    loading: spacesLoading,
    addSpace,
    editSpace,
    moveSpaceTo,
    removeSpace,
  } = useSpaces();
  const {
    items,
    loading: itemsLoading,
    addItem,
    editItem,
    removeItem,
  } = useItems(id);
  const { tags } = useAllTags();
  const workspace = useWorkspace({
    spaces,
    tags,
    defaultSpaceId: id,
    addSpace,
    editSpace,
    moveSpaceTo,
    removeSpace,
    addItem,
    editItem,
    removeItem,
  });

  const breadcrumb = findPath(spaces, id);
  const currentNode = breadcrumb.at(-1) ?? null;

  // A link into another environment — a bookmark followed after the space was
  // moved, or a search result from an "all environments" search. Rather than
  // showing an empty page, look the space up (fetchSpace is not environment-
  // scoped) and switch scope to wherever it actually lives.
  const strayQuery = useQuery({
    queryKey: queryKeys.spaceEnvironment(userId, id),
    enabled: !!userId && !!environmentId && !spacesLoading && !currentNode,
    queryFn: async () => {
      const result = await fetchSpace(id);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  const strayEnvironmentId = strayQuery.data?.environment_id ?? null;
  const switching =
    !!strayEnvironmentId && strayEnvironmentId !== environmentId;

  useEffect(() => {
    if (switching) setEnvironmentId(strayEnvironmentId!);
  }, [switching, strayEnvironmentId, setEnvironmentId]);

  // Not in this environment's tree, and the lookup found it nowhere else (or
  // failed): the space doesn't exist, or isn't this user's.
  const notFound =
    !spacesLoading &&
    !currentNode &&
    !switching &&
    (strayQuery.isSuccess || strayQuery.isError);

  if (notFound) {
    return (
      <div className="space-y-4 py-12 text-center">
        <p className="font-medium">This space doesn&apos;t exist</p>
        <p className="text-sm text-muted-foreground">
          It may have been deleted.
        </p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/dashboard">Back to your spaces</Link>
        </Button>
      </div>
    );
  }

  if (!currentNode) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-1 text-sm text-muted-foreground flex-wrap">
          <li>
            <Link href="/dashboard" className="hover:text-foreground">
              <Home className="h-4 w-4" />
            </Link>
          </li>
          {breadcrumb.map((crumb, i) => (
            <li key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="h-3.5 w-3.5 shrink-0" />
              {i === breadcrumb.length - 1 ? (
                <span className="font-medium text-foreground">{crumb.name}</span>
              ) : (
                <Link href={`/spaces/${crumb.id}`} className="hover:text-foreground">
                  {crumb.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {currentNode.name}
          </h1>
          {currentNode.description && (
            <p className="mt-1 text-muted-foreground">{currentNode.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => workspace.openEditSpace(currentNode)}
          >
            Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => workspace.openMoveSpace(currentNode)}
          >
            Move
          </Button>
          <Button size="sm" onClick={() => workspace.openAddSpace(id)}>
            <Plus className="mr-1 h-4 w-4" />
            Add space
          </Button>
        </div>
      </div>

      {/* Child spaces */}
      <SpaceTreemap
        spaces={currentNode.children}
        onAddRoot={() => workspace.openAddSpace(id)}
        onAddChild={workspace.openAddSpace}
        onEdit={workspace.openEditSpace}
        onMove={workspace.openMoveSpace}
        onDelete={workspace.deleteSpace}
      />

      {/* Items */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Items {items.length > 0 && `(${items.length})`}
          </h2>
          <Button size="sm" variant="outline" onClick={workspace.openAddItem}>
            <Plus className="mr-1 h-4 w-4" />
            Add item
          </Button>
        </div>

        {itemsLoading ? (
          <p className="text-sm text-muted-foreground py-4 animate-pulse">
            Loading items…
          </p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No items in this space yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onEdit={workspace.openEditItem}
                onMove={workspace.openMoveItem}
                onDelete={workspace.deleteItem}
              />
            ))}
          </div>
        )}
      </section>

      <Separator />

      <WorkspaceDialogs workspace={workspace} />
    </div>
  );
}
