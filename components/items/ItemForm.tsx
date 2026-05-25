"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { flattenSpaces } from "@/lib/utils";
import type { Item, SpaceNode } from "@/lib/types";

interface ItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-populate for editing an existing item. */
  initialValues?: Item;
  /** Pre-selected space when adding an item inside a space. */
  defaultSpaceId?: string | null;
  /** All spaces for the assignment dropdown. */
  allSpaces: SpaceNode[];
  onSubmit: (values: {
    name: string;
    description: string | null;
    space_id: string | null;
    tags: string[];
  }) => Promise<string | null>;
}

/**
 * Modal form for creating or editing an item.
 *
 * Includes a space assignment dropdown and an inline tag editor (press Enter
 * to add, click × to remove).
 *
 * @param open - Controls dialog visibility.
 * @param onOpenChange - Called when the dialog requests a visibility change.
 * @param initialValues - Pre-fills the form for edit mode.
 * @param defaultSpaceId - Pre-selects a space when adding from a space page.
 * @param allSpaces - Full list of spaces for the assignment dropdown.
 * @param onSubmit - Async submission handler; returns an error string or null.
 */
export function ItemForm({
  open,
  onOpenChange,
  initialValues,
  defaultSpaceId,
  allSpaces,
  onSubmit,
}: ItemFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isEditing = !!initialValues?.id;

  useEffect(() => {
    if (open) {
      setName(initialValues?.name ?? "");
      setDescription(initialValues?.description ?? "");
      setSpaceId(initialValues?.space_id ?? defaultSpaceId ?? null);
      setTags(initialValues?.tags ?? []);
      setTagInput("");
      setError(null);
    }
  }, [open, initialValues, defaultSpaceId]);

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const trimmed = tagInput.trim().toLowerCase();
      if (trimmed && !tags.includes(trimmed)) {
        setTags((prev) => [...prev, trimmed]);
      }
      setTagInput("");
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    setLoading(true);
    const err = await onSubmit({
      name: name.trim(),
      description: description.trim() || null,
      space_id: spaceId,
      tags,
    });
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
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit item" : "Add item"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="item-name">Name *</Label>
            <Input
              id="item-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Winter coats"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="item-space">Location</Label>
            <Select
              value={spaceId ?? "__none__"}
              onValueChange={(v) => setSpaceId(v === "__none__" ? null : v)}
            >
              <SelectTrigger id="item-space">
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

          <div className="space-y-2">
            <Label htmlFor="item-tags">Tags</Label>
            <div className="flex flex-wrap gap-1 rounded-md border border-input bg-background px-3 py-2 min-h-[40px]">
              {tags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 text-xs">
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </Badge>
              ))}
              <input
                id="item-tags"
                className="flex-1 min-w-[80px] bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleTagKeyDown}
                placeholder={tags.length === 0 ? "Type and press Enter" : ""}
                aria-label="Add tag"
              />
            </div>
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
              {loading ? "Saving…" : isEditing ? "Save changes" : "Add item"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
