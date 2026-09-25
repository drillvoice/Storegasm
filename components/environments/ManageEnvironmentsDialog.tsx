"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EnvironmentForm } from "@/components/environments/EnvironmentForm";
import { useEnvironments } from "@/hooks/useEnvironments";
import { api } from "@/lib/api/client";
import type { Environment } from "@/lib/types";

interface ManageEnvironmentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Lists every environment, archived ones included, with rename, archive and
 * delete.
 *
 * Archiving is the intended way to retire the house you moved out of: it drops
 * out of the switcher but keeps its spaces and items, so "where did that live
 * before?" is still answerable. Deleting destroys everything inside it.
 */
export function ManageEnvironmentsDialog({
  open,
  onOpenChange,
}: ManageEnvironmentsDialogProps) {
  const { environments, addEnvironment, editEnvironment, removeEnvironment } =
    useEnvironments();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Environment | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Environment | null>(null);
  const [deleteDescription, setDeleteDescription] = useState<string>("");

  function openRename(environment: Environment) {
    setEditing(environment);
    setFormOpen(true);
  }

  async function handleFormSubmit(values: {
    name: string;
    description: string | null;
  }) {
    if (editing) return editEnvironment(editing.id, values);
    const { error: err } = await addEnvironment(values);
    return err;
  }

  async function toggleArchive(environment: Environment) {
    setError(null);
    const err = await editEnvironment(environment.id, {
      archived_at: environment.archived_at ? null : new Date().toISOString(),
    });
    if (err) setError(err);
  }

  async function askDelete(environment: Environment) {
    setError(null);
    setPendingDelete(environment);
    // Say what will be destroyed before the user commits to it.
    const counts = await api
      .environmentContents(environment.id)
      .catch(() => null);
    setDeleteDescription(
      counts
        ? `This permanently deletes ${counts.spaces} ${
            counts.spaces === 1 ? "space" : "spaces"
          } and ${counts.items} ${
            counts.items === 1 ? "item" : "items"
          }. Archive it instead if you just want it out of the way.`
        : "This permanently deletes every space and item inside it."
    );
    setConfirmOpen(true);
  }

  async function handleDelete() {
    if (!pendingDelete) return;
    const err = await removeEnvironment(pendingDelete.id);
    if (err) setError(err);
    setPendingDelete(null);
  }

  const active = environments.filter((e) => !e.archived_at);
  const archived = environments.filter((e) => e.archived_at);

  function renderRow(environment: Environment) {
    return (
      <li
        key={environment.id}
        className="flex items-center gap-1 rounded-md border px-3 py-2"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{environment.name}</p>
          {environment.description && (
            <p className="truncate text-xs text-muted-foreground">
              {environment.description}
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={`Rename ${environment.name}`}
          onClick={() => openRename(environment)}
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label={
            environment.archived_at
              ? `Restore ${environment.name}`
              : `Archive ${environment.name}`
          }
          onClick={() => toggleArchive(environment)}
        >
          {environment.archived_at ? (
            <ArchiveRestore className="h-4 w-4" />
          ) : (
            <Archive className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive"
          aria-label={`Delete ${environment.name}`}
          onClick={() => askDelete(environment)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </li>
    );
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Environments</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <ul className="space-y-2">{active.map(renderRow)}</ul>

            {archived.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Archived
                </p>
                <ul className="space-y-2 opacity-60">
                  {archived.map(renderRow)}
                </ul>
              </div>
            )}

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              New environment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <EnvironmentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        initialValues={editing ?? undefined}
        onSubmit={handleFormSubmit}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Delete "${pendingDelete?.name}"?`}
        description={deleteDescription}
        onConfirm={handleDelete}
      />
    </>
  );
}
