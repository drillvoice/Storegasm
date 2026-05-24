"use client";

import { useState, use } from "react";
import Link from "next/link";
import { Plus, ChevronRight, Home } from "lucide-react";
import { useSpaces } from "@/hooks/useSpaces";
import { useItems } from "@/hooks/useItems";
import { SpaceCard } from "@/components/spaces/SpaceCard";
import { SpaceForm } from "@/components/spaces/SpaceForm";
import { ItemCard } from "@/components/items/ItemCard";
import { ItemForm } from "@/components/items/ItemForm";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SpaceNode, Item } from "@/lib/types";

/**
 * Space detail page — shows the breadcrumb, child spaces, and items for a
 * single space identified by `params.id`.
 */
export default function SpacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { spaces, addSpace, editSpace, removeSpace } = useSpaces();
  const { items, addItem, editItem, removeItem } = useItems(id);

  // Derive the current space and its breadcrumb from the flat tree.
  function findNode(nodes: SpaceNode[], targetId: string): SpaceNode | null {
    for (const node of nodes) {
      if (node.id === targetId) return node;
      const found = findNode(node.children, targetId);
      if (found) return found;
    }
    return null;
  }

  function buildBreadcrumb(
    nodes: SpaceNode[],
    targetId: string,
    path: SpaceNode[] = []
  ): SpaceNode[] {
    for (const node of nodes) {
      const newPath = [...path, node];
      if (node.id === targetId) return newPath;
      const found = buildBreadcrumb(node.children, targetId, newPath);
      if (found.length) return found;
    }
    return [];
  }

  const currentNode = findNode(spaces, id);
  const breadcrumb = buildBreadcrumb(spaces, id);

  // Space form state
  const [spaceFormOpen, setSpaceFormOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<SpaceNode | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  // Item form state
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  function openAddChild() {
    setEditingSpace(null);
    setDefaultParentId(id);
    setSpaceFormOpen(true);
  }

  function openEditSpace(node: SpaceNode) {
    setEditingSpace(node);
    setDefaultParentId(null);
    setSpaceFormOpen(true);
  }

  async function handleDeleteSpace(node: SpaceNode) {
    if (confirm(`Delete "${node.name}" and all its contents?`)) {
      await removeSpace(node.id);
    }
  }

  async function handleSpaceSubmit(values: {
    name: string;
    description: string | null;
    parent_id: string | null;
  }) {
    if (editingSpace) return editSpace(editingSpace.id, values);
    return addSpace(values);
  }

  function openAddItem() {
    setEditingItem(null);
    setItemFormOpen(true);
  }

  function openEditItem(item: Item) {
    setEditingItem(item);
    setItemFormOpen(true);
  }

  async function handleDeleteItem(item: Item) {
    if (confirm(`Delete "${item.name}"?`)) {
      await removeItem(item.id);
    }
  }

  async function handleItemSubmit(values: {
    name: string;
    description: string | null;
    space_id: string | null;
    tags: string[];
  }) {
    if (editingItem) return editItem(editingItem.id, values);
    return addItem({ ...values, space_id: values.space_id ?? id });
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
            {currentNode?.name ?? "Space"}
          </h1>
          {currentNode?.description && (
            <p className="mt-1 text-muted-foreground">{currentNode.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {currentNode && (
            <Button variant="outline" size="sm" onClick={() => openEditSpace(currentNode)}>
              Edit
            </Button>
          )}
          <Button size="sm" onClick={openAddChild}>
            <Plus className="mr-1 h-4 w-4" />
            Add space
          </Button>
        </div>
      </div>

      {/* Child spaces */}
      {currentNode && currentNode.children.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Sub-spaces
          </h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {currentNode.children.map((child) => (
              <SpaceCard key={child.id} space={child} />
            ))}
          </div>
        </section>
      )}

      {/* Items */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Items {items.length > 0 && `(${items.length})`}
          </h2>
          <Button size="sm" variant="outline" onClick={openAddItem}>
            <Plus className="mr-1 h-4 w-4" />
            Add item
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No items in this space yet.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                onEdit={openEditItem}
                onDelete={handleDeleteItem}
              />
            ))}
          </div>
        )}
      </section>

      <Separator />

      <SpaceForm
        open={spaceFormOpen}
        onOpenChange={setSpaceFormOpen}
        initialValues={editingSpace ?? undefined}
        defaultParentId={defaultParentId}
        allSpaces={spaces}
        onSubmit={handleSpaceSubmit}
      />

      <ItemForm
        open={itemFormOpen}
        onOpenChange={setItemFormOpen}
        initialValues={editingItem ?? undefined}
        defaultSpaceId={id}
        allSpaces={spaces}
        onSubmit={handleItemSubmit}
      />
    </div>
  );
}
