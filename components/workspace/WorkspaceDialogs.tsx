"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import type {
  CreateItemPayload,
  CreateSpacePayload,
  Item,
  MoveSpacePayload,
  SpaceNode,
  UpdateItemPayload,
  UpdateSpacePayload,
} from "@/lib/types";

// Dialogs load on first open, not with the page.
const SpaceForm = dynamic(() =>
  import("@/components/spaces/SpaceForm").then((m) => m.SpaceForm)
);
const ItemForm = dynamic(() =>
  import("@/components/items/ItemForm").then((m) => m.ItemForm)
);
const MoveItemDialog = dynamic(() =>
  import("@/components/items/MoveItemDialog").then((m) => m.MoveItemDialog)
);
const MoveSpaceDialog = dynamic(() =>
  import("@/components/spaces/MoveSpaceDialog").then((m) => m.MoveSpaceDialog)
);
const ConfirmDialog = dynamic(() =>
  import("@/components/ui/confirm-dialog").then((m) => m.ConfirmDialog)
);

/** Each returns an error message, or null on success — as the data hooks do. */
type Result = Promise<string | null>;

interface WorkspaceOptions {
  /** The environment's space tree, for the pickers. */
  spaces: SpaceNode[];
  /** Tag suggestions for the item form. */
  tags: string[];
  /**
   * The space new items go into unless the form says otherwise — the space
   * being viewed, or undefined on the dashboard (new items are unassigned).
   */
  defaultSpaceId?: string;
  addSpace: (payload: CreateSpacePayload) => Result;
  editSpace: (spaceId: string, payload: UpdateSpacePayload) => Result;
  moveSpaceTo: (spaceId: string, payload: MoveSpacePayload) => Result;
  removeSpace: (spaceId: string) => Result;
  addItem: (payload: CreateItemPayload) => Result;
  editItem: (itemId: string, payload: UpdateItemPayload) => Result;
  removeItem: (itemId: string) => Result;
}

/**
 * The add, edit, move and delete dialogs shared by the dashboard and the
 * space page, and the actions that open them.
 *
 * Pass the result to <WorkspaceDialogs> to render the dialogs, and wire the
 * returned openers to the page's buttons and cards.
 */
export function useWorkspace(options: WorkspaceOptions) {
  // Space form
  const [spaceFormOpen, setSpaceFormOpen] = useState(false);
  const [editingSpace, setEditingSpace] = useState<SpaceNode | null>(null);
  const [defaultParentId, setDefaultParentId] = useState<string | null>(null);

  // Item form
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);

  // Move dialogs — one for items, one for whole spaces
  const [moveItemOpen, setMoveItemOpen] = useState(false);
  const [movingItem, setMovingItem] = useState<Item | null>(null);
  const [moveSpaceOpen, setMoveSpaceOpen] = useState(false);
  const [movingSpace, setMovingSpace] = useState<SpaceNode | null>(null);

  // One confirmation dialog serves both space and item deletes
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTitle, setConfirmTitle] = useState("");
  const pendingAction = useRef<() => void>(() => {});

  function askConfirm(title: string, action: () => void) {
    setConfirmTitle(title);
    pendingAction.current = action;
    setConfirmOpen(true);
  }

  return {
    options,
    state: {
      spaceFormOpen,
      setSpaceFormOpen,
      editingSpace,
      defaultParentId,
      itemFormOpen,
      setItemFormOpen,
      editingItem,
      moveItemOpen,
      setMoveItemOpen,
      movingItem,
      moveSpaceOpen,
      setMoveSpaceOpen,
      movingSpace,
      confirmOpen,
      setConfirmOpen,
      confirmTitle,
      pendingAction,
    },

    /** Opens the space form to add a space under `parentId` (null: top level). */
    openAddSpace(parentId: string | null) {
      setEditingSpace(null);
      setDefaultParentId(parentId);
      setSpaceFormOpen(true);
    },
    openEditSpace(node: SpaceNode) {
      setEditingSpace(node);
      setDefaultParentId(null);
      setSpaceFormOpen(true);
    },
    openMoveSpace(node: SpaceNode) {
      setMovingSpace(node);
      setMoveSpaceOpen(true);
    },
    deleteSpace(node: SpaceNode) {
      askConfirm(`Delete "${node.name}" and all its contents?`, () =>
        options.removeSpace(node.id)
      );
    },

    openAddItem() {
      setEditingItem(null);
      setItemFormOpen(true);
    },
    openEditItem(item: Item) {
      setEditingItem(item);
      setItemFormOpen(true);
    },
    openMoveItem(item: Item) {
      setMovingItem(item);
      setMoveItemOpen(true);
    },
    deleteItem(item: Item) {
      askConfirm(`Delete "${item.name}"?`, () => options.removeItem(item.id));
    },
  };
}

export type Workspace = ReturnType<typeof useWorkspace>;

/** Renders the dialogs a useWorkspace() result controls. */
export function WorkspaceDialogs({ workspace }: { workspace: Workspace }) {
  const { options, state } = workspace;

  async function handleSpaceSubmit(values: {
    name: string;
    description: string | null;
    parent_id: string | null;
  }) {
    if (state.editingSpace) {
      return options.editSpace(state.editingSpace.id, values);
    }
    return options.addSpace(values);
  }

  async function handleItemSubmit(values: {
    name: string;
    description: string | null;
    space_id: string | null;
    tags: string[];
  }) {
    if (state.editingItem) {
      return options.editItem(state.editingItem.id, values);
    }
    return options.addItem({
      ...values,
      space_id: values.space_id ?? options.defaultSpaceId ?? null,
    });
  }

  return (
    <>
      <SpaceForm
        open={state.spaceFormOpen}
        onOpenChange={state.setSpaceFormOpen}
        initialValues={state.editingSpace ?? undefined}
        defaultParentId={state.defaultParentId}
        allSpaces={options.spaces}
        onSubmit={handleSpaceSubmit}
      />

      <ItemForm
        open={state.itemFormOpen}
        onOpenChange={state.setItemFormOpen}
        initialValues={state.editingItem ?? undefined}
        defaultSpaceId={options.defaultSpaceId}
        allSpaces={options.spaces}
        existingTags={options.tags}
        onSubmit={handleItemSubmit}
      />

      <MoveItemDialog
        open={state.moveItemOpen}
        onOpenChange={state.setMoveItemOpen}
        item={state.movingItem}
        allSpaces={options.spaces}
        onMove={(itemId, spaceId) =>
          options.editItem(itemId, { space_id: spaceId })
        }
      />

      <MoveSpaceDialog
        open={state.moveSpaceOpen}
        onOpenChange={state.setMoveSpaceOpen}
        space={state.movingSpace}
        onMove={options.moveSpaceTo}
      />

      <ConfirmDialog
        open={state.confirmOpen}
        onOpenChange={state.setConfirmOpen}
        title={state.confirmTitle}
        onConfirm={() => state.pendingAction.current()}
      />
    </>
  );
}
