"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useSpaces } from "@/hooks/useSpaces";
import { useItems } from "@/hooks/useItems";
import { SpaceTree } from "@/components/spaces/SpaceTree";
import { SpaceForm } from "@/components/spaces/SpaceForm";
import { ItemCard } from "@/components/items/ItemCard";
import { ItemForm } from "@/components/items/ItemForm";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import type { SpaceNode, Item } from "@/lib/types";

/**
 * Dashboard page — displays the full space tree and unassigned items.
 *
 * All mutations go through the useSpaces and useItems hooks which handle
 * refresh after each change.
 */
export default function DashboardPage() {
  const { spaces, loading, addSpace, editSpace, removeSpace } = useSpaces();
  const { items: unassigned, addItem, editItem, removeItem } = useItems(null);

  // Space form state
  const [spaceFormOpen, setSpaceFormOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<SpaceNode | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  // Item form state
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  function openAddRoot() {
    setEditingSpace(null);
    setDefaultParentId(null);
    setSpaceFormOpen(true);
  }

  function openAddChild(parentId: string) {
    setEditingSpace(null);
    setDefaultParentId(parentId);
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
    if (editingSpace) {
      return editSpace(editingSpace.id, values);
    }
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
    if (editingItem) {
      return editItem(editingItem.id, values);
    }
    return addItem(values);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <p className="text-muted-foreground animate-pulse">Loading…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Your spaces</h1>
        <Button onClick={openAddRoot} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add space
        </Button>
      </div>

      <SpaceTree
        spaces={spaces}
        onAddRoot={openAddRoot}
        onAddChild={openAddChild}
        onEdit={openEditSpace}
        onDelete={handleDeleteSpace}
      />

      {unassigned.length > 0 && (
        <>
          <Separator />
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Unassigned items</h2>
            </div>
            <div className="space-y-2">
              {unassigned.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={openEditItem}
                  onDelete={handleDeleteItem}
                />
              ))}
            </div>
          </section>
        </>
      )}

      <div className="fixed bottom-6 right-6">
        <Button onClick={openAddItem} size="lg" className="rounded-full shadow-lg">
          <Plus className="mr-2 h-5 w-5" />
          Add item
        </Button>
      </div>

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
        allSpaces={spaces}
        onSubmit={handleItemSubmit}
      />
    </div>
  );
}
