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
import type { SpaceNode } from "@/lib/types";

interface SpaceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-populate with an existing space's values for editing. */
  initialValues?: { id?: string; name: string; description?: string | null; parent_id?: string | null };
  /** Pre-selected parent when adding a child space. */
  defaultParentId?: string | null;
  /** All spaces flat-listed for the parent selector. */
  allSpaces: SpaceNode[];
  onSubmit: (values: {
    name: string;
    description: string | null;
    parent_id: string | null;
  }) => Promise<string | null>;
}

/**
 * Modal form for creating or editing a storage space.
 *
 * Includes a parent-space selector built from the flat list of all spaces.
 * Calls `onSubmit` with the form values and closes on success.
 *
 * @param open - Controls dialog visibility.
 * @param onOpenChange - Called when the dialog requests a visibility change.
 * @param initialValues - Pre-fills the form for edit mode.
 * @param defaultParentId - Pre-selects a parent for the "add child" flow.
 * @param allSpaces - Full list of spaces for the parent dropdown.
 * @param onSubmit - Async submission handler; returns an error string or null.
 */
export function SpaceForm({
  open,
  onOpenChange,
  initialValues,
  defaultParentId,
  allSpaces,
  onSubmit,
}: SpaceFormProps) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isEditing = !!initialValues?.id;

  useEffect(() => {
    if (open) {
      setName(initialValues?.name ?? "");
      setDescription(initialValues?.description ?? "");
      setParentId(initialValues?.parent_id ?? defaultParentId ?? null);
      setError(null);
    }
  }, [open, initialValues, defaultParentId]);

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
      parent_id: parentId,
    });
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      onOpenChange(false);
    }
  }

  /** Flattens a SpaceNode tree into depth-labelled options for the select. */
  function flattenSpaces(nodes: SpaceNode[], depth = 0): Array<{ id: string; label: string }> {
    return nodes.flatMap((n) => [
      { id: n.id, label: "  ".repeat(depth) + n.name },
      ...flattenSpaces(n.children, depth + 1),
    ]);
  }

  const flatSpaces = flattenSpaces(allSpaces).filter(
    (s) => s.id !== initialValues?.id // can't parent to self
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit space" : "Add space"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="space-name">Name *</Label>
            <Input
              id="space-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Under bed"
              autoFocus
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="space-description">Description</Label>
            <Textarea
              id="space-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this space"
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="space-parent">Parent space</Label>
            <Select
              value={parentId ?? "__none__"}
              onValueChange={(v) => setParentId(v === "__none__" ? null : v)}
            >
              <SelectTrigger id="space-parent">
                <SelectValue placeholder="None (top-level)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (top-level)</SelectItem>
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
              {loading ? "Saving…" : isEditing ? "Save changes" : "Add space"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
