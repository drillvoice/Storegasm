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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Environment } from "@/lib/types";

interface EnvironmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Omit to create a new environment, pass one to rename/re-describe it. */
  initialValues?: Environment;
  onSubmit: (values: {
    name: string;
    description: string | null;
  }) => Promise<string | null>;
}

/**
 * Create/edit dialog for an environment — a house, an office, a studio.
 */
export function EnvironmentForm({
  open,
  onOpenChange,
  initialValues,
  onSubmit,
}: EnvironmentFormProps) {
  const isEditing = !!initialValues;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset the form each time the dialog opens. Done as a render-time
  // adjustment (not an effect) so it happens before paint.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName(initialValues?.name ?? "");
      setDescription(initialValues?.description ?? "");
      setError(null);
    }
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
    });
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      onOpenChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {isEditing ? "Rename environment" : "New environment"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="environment-name">Name *</Label>
            <Input
              id="environment-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="New house"
              maxLength={200}
              autoFocus
            />
            {!isEditing && (
              <p className="text-xs text-muted-foreground">
                A separate place with its own spaces — a house you&rsquo;re
                moving to, a workplace, a studio.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="environment-description">Description</Label>
            <Textarea
              id="environment-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={2000}
            />
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
              {loading ? "Saving…" : isEditing ? "Save" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
