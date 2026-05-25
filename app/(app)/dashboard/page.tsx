"use client";

import { useState, useRef } from "react";
import { Plus } from "lucide-react";
import { useSpaces } from "@/hooks/useSpaces";
import { useItems } from "@/hooks/useItems";
import { SpaceTreemap } from "@/components/spaces/SpaceTreemap";
import { SpaceForm } from "@/components/spaces/SpaceForm";
import { ItemCard } from "@/components/items/ItemCard";
import { ItemForm } from "@/components/items/ItemForm";
import { MoveItemDialog } from "@/components/items/MoveItemDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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

  // Move dialog state
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingItem, setMovingItem] = useState<Item | null>(null);

  // Confirm dialog state — one dialog handles both space and item deletes
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const pendingAction = useRef<() => void>(() => {});

  function askConfirm(title: string, action: () => void) {
    setConfirmTitle(title);
    pendingAction.current = action;
    setConfirmOpen(true);
  }

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

  function handleDeleteSpace(node: SpaceNode) {
    askConfirm(
      `Delete "${node.name}" and all its contents?`,
      () => removeSpace(node.id)
    );
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

  function openMoveItem(item: Item) {
    setMovingItem(item);
    setMoveDialogOpen(true);
  }

  async function handleMoveItem(itemId: string, spaceId: string | null) {
    return editItem(itemId, { space_id: spaceId });
  }

  function handleDeleteItem(item: Item) {
    askConfirm(`Delete "${item.name}"?`, () => removeItem(item.id));
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

      <SpaceTreemap
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
            <div className="grid grid-cols-2 gap-2">
              {unassigned.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onEdit={openEditItem}
                  onMove={openMoveItem}
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

      <MoveItemDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        item={movingItem}
        allSpaces={spaces}
        onMove={handleMoveItem}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={confirmTitle}
        onConfirm={() => pendingAction.current()}
      />
    </div>
  );
}
