"use client";

import { Package, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Item } from "@/lib/types";

interface ItemCardProps {
  item: Item;
  /** Optional space path shown when displaying search results. */
  spacePath?: string | null;
  onEdit: (item: Item) => void;
  onDelete: (item: Item) => void;
}

/**
 * Displays an item's name, description, and tags with edit/delete actions.
 *
 * @param item - The Item record to display.
 * @param spacePath - Breadcrumb path shown in search results.
 * @param onEdit - Called when the edit button is clicked.
 * @param onDelete - Called when the delete button is clicked.
 */
export function ItemCard({ item, spacePath, onEdit, onDelete }: ItemCardProps) {
  return (
    <div className="group flex items-start gap-3 rounded-lg border border-border bg-card px-4 py-3">
      <Package className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />

      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{item.name}</p>
        {spacePath && (
          <p className="text-xs text-primary mt-0.5 truncate">{spacePath}</p>
        )}
        {item.description && (
          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
            {item.description}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label={`Edit ${item.name}`}
          onClick={() => onEdit(item)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-destructive"
          aria-label={`Delete ${item.name}`}
          onClick={() => onDelete(item)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
