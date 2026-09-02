"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { useActiveEnvironment } from "@/components/EnvironmentProvider";
import { useUserId } from "@/hooks/useUserId";
import { fetchSpaceTree } from "@/lib/actions/spaces";
import { collectSubtreeIds, flattenSpaces } from "@/lib/utils";
import type { MoveSpacePayload, SpaceNode } from "@/lib/types";

const TOP_LEVEL = "__top__";

interface MoveSpaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  space: SpaceNode | null;
  onMove: (
    spaceId: string,
    payload: MoveSpacePayload
  ) => Promise<string | null>;
}

/**
 * Moves a space — and everything inside it — to another environment.
 *
 * This is the "that box of books comes with me to the new house" operation:
 * pick the destination environment, then where in it the space should land.
 * Sub-spaces and items come along, so a whole room can be moved in one go.
 */
export function MoveSpaceDialog({
  open,
  onOpenChange,
  space,
  onMove,
}: MoveSpaceDialogProps) {
  const userId = useUserId();
  const { environments, environmentId: activeEnvironmentId } =
    useActiveEnvironment();

  const [targetEnvironmentId, setTargetEnvironmentId] = useState<string | null>(
    null
  );
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Reset each time the dialog opens. Done as a render-time adjustment (not an
  // effect) so it happens before paint.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTargetEnvironmentId(space?.environment_id ?? activeEnvironmentId);
      setParentId(null);
      setError(null);
    }
  }

  // The destination environment's tree. Shares the query key with useSpaces,
  // so the environment you're already in costs nothing to show.
  const treeQuery = useQuery({
    queryKey: ["spaces", userId, targetEnvironmentId],
    enabled: !!userId && !!targetEnvironmentId && open,
    queryFn: async () => {
      const result = await fetchSpaceTree(targetEnvironmentId!);
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  const targetTree = treeQuery.data ?? [];
  // Only relevant when moving within one environment; across environments the
  // subtree can't contain anything in the destination.
  const excluded =
    space && targetEnvironmentId === space.environment_id
      ? collectSubtreeIds(targetTree, space.id)
      : new Set<string>();
  const destinations = flattenSpaces(targetTree).filter(
    (s) => !excluded.has(s.id)
  );

  const targetEnvironment = environments.find(
    (e) => e.id === targetEnvironmentId
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!space || !targetEnvironmentId) return;
    setLoading(true);
    const err = await onMove(space.id, {
      environment_id: targetEnvironmentId,
      parent_id: parentId,
    });
    setLoading(false);
    if (err) {
      setError(err);
    } else {
      onOpenChange(false);
    }
  }

  const contents = space
    ? space.children.length === 1
      ? "1 space inside"
      : `${space.children.length} spaces inside`
    : "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Move &ldquo;{space?.name}&rdquo;</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <p className="text-sm text-muted-foreground">
            Everything inside comes with it
            {space && space.children.length > 0 ? ` — ${contents}` : ""}.
          </p>

          <div className="space-y-2">
            <Label htmlFor="move-space-environment">Environment</Label>
            <Select
              value={targetEnvironmentId ?? undefined}
              onValueChange={(v) => {
                setTargetEnvironmentId(v);
                // The old destination belongs to the old environment.
                setParentId(null);
              }}
            >
              <SelectTrigger id="move-space-environment">
                <SelectValue placeholder="Choose an environment" />
              </SelectTrigger>
              <SelectContent>
                {environments.map((env) => (
                  <SelectItem key={env.id} value={env.id}>
                    {env.name}
                    {env.archived_at ? " (archived)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="move-space-parent">Put it in</Label>
            <Select
              value={parentId ?? TOP_LEVEL}
              onValueChange={(v) => setParentId(v === TOP_LEVEL ? null : v)}
              disabled={treeQuery.isPending}
            >
              <SelectTrigger id="move-space-parent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TOP_LEVEL}>
                  Top level{targetEnvironment ? ` of ${targetEnvironment.name}` : ""}
                </SelectItem>
                {destinations.map((s) => (
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
            <Button type="submit" disabled={loading || !targetEnvironmentId}>
              {loading ? "Moving…" : "Move"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
