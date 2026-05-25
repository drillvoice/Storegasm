"use client";

import { useState } from "react";
import { Package, Pencil, Trash2, MoreVertical, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Item } from "@/lib/types";

interface ItemCardProps {
  item: Item;
  /** Optional space path shown when displaying search results. */
  spacePath?: string | null;
  onEdit: (item: Item) => void;
  onMove: (item: Item) => void;
  onDelete: (item: Item) => void;
}

export function ItemCard({ item, spacePath, onEdit, onMove, onDelete }: ItemCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  function action(fn: () => void) {
    setMenuOpen(false);
    fn();
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
      <Package className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{item.name}</p>
        {spacePath && (
          <p className="text-xs text-primary truncate">{spacePath}</p>
        )}
        {item.description && (
          <p className="text-xs text-muted-foreground truncate">
            {item.description}
          </p>
        )}
        {item.tags.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {item.tags.map((tag) => (
              <Badge key={tag} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <Popover open={menuOpen} onOpenChange={setMenuOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label={`Actions for ${item.name}`}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" align="end">
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => action(() => onEdit(item))}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
            onClick={() => action(() => onMove(item))}
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
            Move to…
          </button>
          <button
            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive hover:bg-accent"
            onClick={() => action(() => onDelete(item))}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
