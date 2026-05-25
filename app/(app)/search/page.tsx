"use client";

import { useState, useEffect, useRef } from "react";
import { Search } from "lucide-react";
import { useItemSearch } from "@/hooks/useItems";
import { useSpaces } from "@/hooks/useSpaces";
import { ItemCard } from "@/components/items/ItemCard";
import { ItemForm } from "@/components/items/ItemForm";
import { MoveItemDialog } from "@/components/items/MoveItemDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";
import { updateItem, deleteItem } from "@/lib/db/items";
import type { ItemWithSpace, Item } from "@/lib/types";

/**
 * Search page — full-text search across all items.
 *
 * Uses a debounced Postgres tsvector query (via `useItemSearch`) so results
 * update as the user types without hammering the database.
 */
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const { results: searchResults, loading, error } = useItemSearch(query);
  const { spaces } = useSpaces();

  // Local mirror of search results — updated optimistically on edit/delete
  // so the list reflects mutations without waiting for the debounced re-fetch.
  const [results, setResults] = useState<ItemWithSpace[]>([]);
  useEffect(() => { setResults(searchResults); }, [searchResults]);

  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [movingItem, setMovingItem] = useState<Item | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const pendingAction = useRef<() => void>(() => {});

  function openEditItem(item: Item) {
    setEditingItem(item);
    setItemFormOpen(true);
  }

  function openMoveItem(item: Item) {
    setMovingItem(item);
    setMoveDialogOpen(true);
  }

  async function handleMoveItem(itemId: string, spaceId: string | null): Promise<string | null> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not authenticated";
    const result = await updateItem(supabase, user.id, itemId, { space_id: spaceId });
    if (result.error) return result.error.message;
    setResults((prev) =>
      prev.map((r) => r.id === itemId ? { ...r, space_id: spaceId, space: null, space_path: null } : r)
    );
    return null;
  }

  function handleDeleteItem(item: Item) {
    setConfirmTitle(`Delete "${item.name}"?`);
    pendingAction.current = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const result = await deleteItem(supabase, user.id, item.id);
      if (!result.error) {
        setResults((prev) => prev.filter((r) => r.id !== item.id));
      }
    };
    setConfirmOpen(true);
  }

  async function handleItemSubmit(values: {
    name: string;
    description: string | null;
    space_id: string | null;
    tags: string[];
  }): Promise<string | null> {
    if (!editingItem) return "No item selected";
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return "Not authenticated";
    const result = await updateItem(supabase, user.id, editingItem.id, values);
    if (result.error) return result.error.message;
    setResults((prev) =>
      prev.map((r) => (r.id === editingItem.id ? { ...r, ...values } : r))
    );
    return null;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Search</h1>

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
              spacePath={item.space_path}
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
          <p>Start typing to find items across all your spaces.</p>
        </div>
      )}

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
