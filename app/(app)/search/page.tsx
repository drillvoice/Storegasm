"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { useItemSearch } from "@/hooks/useItems";
import { ItemCard } from "@/components/items/ItemCard";
import { Input } from "@/components/ui/input";

/**
 * Search page — full-text search across all items.
 *
 * Uses a debounced Postgres tsvector query (via `useItemSearch`) so results
 * update as the user types without hammering the database.
 */
export default function SearchPage() {
  const [query, setQuery] = useState("");
  const { results, loading, error } = useItemSearch(query);

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
        <div className="space-y-2">
          {results.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              spacePath={item.space_path}
              onEdit={() => {}}
              onDelete={() => {}}
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
    </div>
  );
}
