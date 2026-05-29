"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { flattenSpaces } from "@/lib/utils";
import type { Item, SpaceNode } from "@/lib/types";

interface MoveItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: Item | null;
  allSpaces: SpaceNode[];
  onMove: (itemId: string, spaceId: string | null) => Promise<string | null>;
}

export function MoveItemDialog({
  open,
  onOpenChange,
  item,
  allSpaces,
  onMove,
}: MoveItemDialogProps) {
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset the form to the item's current space each time the dialog opens.
  // Done as a render-time adjustment (not an effect) so it happens before paint.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && item) {
      setSpaceId(item.space_id);
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!item) return;
    setLoading(true);
    const err = await onMove(item.id, spaceId);
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      onOpenChange(false);
    }
  }

  const flatSpaces = flattenSpaces(allSpaces);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[380px]">
        <DialogHeader>
          <DialogTitle>Move &ldquo;{item?.name}&rdquo;</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="move-space">Move to</Label>
            <Select
              value={spaceId ?? "__none__"}
              onValueChange={(v) => setSpaceId(v === "__none__" ? null : v)}
            >
              <SelectTrigger id="move-space">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {flatSpaces.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
