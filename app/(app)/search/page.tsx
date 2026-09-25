"use client";

import { useState } from "react";
import { Globe, Search } from "lucide-react";
import { useItemSearch, useAllTags } from "@/hooks/useItems";
import { useSpaces } from "@/hooks/useSpaces";
import { useItemMutations } from "@/hooks/useItemMutations";
import { useActiveEnvironment } from "@/components/EnvironmentProvider";
import { ItemCard } from "@/components/items/ItemCard";
import { ItemForm } from "@/components/items/ItemForm";
import { MoveItemDialog } from "@/components/items/MoveItemDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ItemWithSpace, Item } from "@/lib/types";

/**
 * Search page — full-text search across the items in scope.
 *
 * Scoped to the current environment by default, with a toggle to span every
 * one: mid-move, "is the drill still at the old place?" is exactly the
 * question you need answered.
 *
 * Uses a debounced Postgres tsvector query (via `useItemSearch`) so results
 * update as the user types without hammering the database.
 */
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [allEnvironments, setAllEnvironments] = useState(false);
  const { results, loading, error } = useItemSearch(query, allEnvironments);
  const { spaces } = useSpaces();
  const { tags: allTags } = useAllTags();
  const { environment, environments, environmentId } = useActiveEnvironment();
  // Patches the search results in place and invalidates the other caches an
  // item change touches, so the dashboard reflects edits made from here.
  const { editItem, removeItem } = useItemMutations();

  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingItem, setMovingItem] = useState<Item | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);

  function openEditItem(item: Item) {
    setEditingItem(item);
    setItemFormOpen(true);
  }

  function openMoveItem(item: Item) {
    setMovingItem(item);
    setMoveDialogOpen(true);
  }

  function handleDeleteItem(item: Item) {
    setDeletingItem(item);
    setConfirmOpen(true);
  }

  async function handleItemSubmit(values: {
    name: string;
    description: string | null;
    space_id: string | null;
    tags: string[];
  }): Promise<string | null> {
    if (!editingItem) return "No item selected";
    return editItem(editingItem.id, values);
  }

  // An all-environments search can surface an item filed somewhere the active
  // environment's space list doesn't contain, so hand the form that one space
  // explicitly rather than letting it read as unassigned.
  const editingResult = results.find((r) => r.id === editingItem?.id) ?? null;
  const extraSpaceOption =
    editingResult &&
    editingResult.space_id &&
    editingResult.environment_id !== environmentId
      ? { id: editingResult.space_id, label: resultPath(editingResult) ?? "" }
      : null;

  // When the search spans every environment, the place is the part of the
  // breadcrumb that actually disambiguates two identically-named rooms.
  function resultPath(item: ItemWithSpace): string | null {
    if (!allEnvironments) return item.space_path;
    const place = item.environment?.name;
    if (!place) return item.space_path;
    return item.space_path ? `${place} › ${item.space_path}` : place;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Search</h1>
        {environments.length > 1 && (
          <Button
            variant={allEnvironments ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={allEnvironments}
            onClick={() => setAllEnvironments((v) => !v)}
          >
            <Globe className="mr-2 h-4 w-4" />
            All environments
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <Input
          className="pl-9"
          placeholder="Search for an item…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground animate-pulse">Searching…</p>
      )}

      {!loading && query.trim() && results.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p>No items found for &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {results.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {results.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              spacePath={resultPath(item)}
              onEdit={openEditItem}
              onMove={openMoveItem}
              onDelete={handleDeleteItem}
            />
          ))}
        </div>
      )}

      {!query.trim() && (
        <div className="py-12 text-center text-muted-foreground">
          <Search className="mx-auto mb-3 h-10 w-10" />
          <p>
            {allEnvironments
              ? "Start typing to find items across every environment."
              : `Start typing to find items across ${
                  environment ? environment.name : "your spaces"
                }.`}
          </p>
        </div>
      )}

      <ItemForm
        open={itemFormOpen}
        onOpenChange={setItemFormOpen}
        initialValues={editingItem ?? undefined}
        allSpaces={spaces}
        extraSpaceOption={extraSpaceOption}
        existingTags={allTags}
        onSubmit={handleItemSubmit}
      />

      <MoveItemDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        item={movingItem}
        allSpaces={spaces}
        onMove={(itemId, spaceId) => editItem(itemId, { space_id: spaceId })}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={deletingItem ? `Delete "${deletingItem.name}"?` : ""}
        onConfirm={() => {
          if (deletingItem) removeItem(deletingItem.id);
        }}
      />
    </div>
  );
}
