"use client";

import { useState, useMemo } from "react";
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
import { cn, flattenSpaces } from "@/lib/utils";
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
  /** All existing tags across the user's items, used for autocomplete suggestions. */
  existingTags?: string[];
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
  existingTags,
  onSubmit,
}: ItemFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [suggestionIndex, setSuggestionIndex] = useState(-1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const suggestions = useMemo(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (!trimmed || !existingTags) return [];
    return existingTags.filter(
      (t) => t.includes(trimmed) && !tags.includes(t)
    );
  }, [tagInput, existingTags, tags]);

  const isEditing = !!initialValues?.id;

  // Reset the form to its initial values each time the dialog opens. Done as a
  // render-time adjustment (not an effect) so it happens before paint.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initialValues?.name ?? "");
      setDescription(initialValues?.description ?? "");
      setSpaceId(initialValues?.space_id ?? defaultSpaceId ?? null);
      setTags(initialValues?.tags ?? []);
      setTagInput("");
      setSuggestionIndex(-1);
      setError(null);
    }
  }

  function selectSuggestion(tag: string) {
    if (!tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setTagInput("");
    setSuggestionIndex(-1);
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSuggestionIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === "Escape") {
      e.preventDefault();
      setSuggestionIndex(-1);
      setTagInput("");
    } else if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (suggestionIndex >= 0 && suggestions[suggestionIndex]) {
        selectSuggestion(suggestions[suggestionIndex]);
      } else {
        const trimmed = tagInput.trim().toLowerCase();
        if (trimmed && !tags.includes(trimmed)) {
          setTags((prev) => [...prev, trimmed]);
        }
        setTagInput("");
        setSuggestionIndex(-1);
      }
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
      <DialogContent className="sm:max-w-[480px] top-4 translate-y-0 p-4 data-[state=open]:slide-in-from-top-4 data-[state=closed]:slide-out-to-top-4">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit item" : "Add item"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-3 pt-1">
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
              rows={1}
              className="min-h-0 resize-none"
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
            <div className="relative">
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
                  onChange={(e) => {
                    setTagInput(e.target.value);
                    setSuggestionIndex(-1);
                  }}
                  onKeyDown={handleTagKeyDown}
                  placeholder={tags.length === 0 ? "Type and press Enter" : ""}
                  aria-label="Add tag"
                  autoComplete="off"
                />
              </div>
              {suggestions.length > 0 && (
                <ul className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-input bg-popover py-1 shadow-md">
                  {suggestions.map((tag, i) => (
                    <li key={tag}>
                      <button
                        type="button"
                        className={cn(
                          "w-full px-3 py-1.5 text-left text-sm",
                          i === suggestionIndex
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent hover:text-accent-foreground"
                        )}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          selectSuggestion(tag);
                        }}
                      >
                        {tag}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <DialogFooter className="flex-row justify-end space-x-2">
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
