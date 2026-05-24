"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight, ChevronDown, Folder, FolderOpen, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { SpaceNode } from "@/lib/types";

interface SpaceTreeNodeProps {
  node: SpaceNode;
  depth: number;
  onAddChild: (parentId: string) => void;
  onEdit: (node: SpaceNode) => void;
  onDelete: (node: SpaceNode) => void;
}

/**
 * Renders a single node in the space tree with expand/collapse and actions.
 */
function SpaceTreeNode({
  node,
  depth,
  onAddChild,
  onEdit,
  onDelete,
}: SpaceTreeNodeProps) {
  const [expanded, setExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;

  return (
    <li>
      <div
        className={cn(
          "group flex items-center gap-1 rounded-md px-2 py-1 hover:bg-accent",
          "text-sm"
        )}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
      >
        {/* Expand/collapse toggle */}
        <button
          type="button"
          aria-label={expanded ? "Collapse" : "Expand"}
          onClick={() => setExpanded((v) => !v)}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
        >
          {hasChildren ? (
            expanded ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
        </button>

        {expanded ? (
          <FolderOpen className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        ) : (
          <Folder className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        )}

        <Link
          href={`/spaces/${node.id}`}
          className="flex-1 truncate font-medium hover:text-primary"
        >
          {node.name}
        </Link>

        {/* Action buttons — visible on hover */}
        <div className="flex shrink-0 items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            aria-label={`Add space inside ${node.name}`}
            onClick={() => onAddChild(node.id)}
          >
            <Plus className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground"
            aria-label={`Edit ${node.name}`}
            onClick={() => onEdit(node)}
          >
            <span className="text-xs">✎</span>
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-destructive"
            aria-label={`Delete ${node.name}`}
            onClick={() => onDelete(node)}
          >
            <span className="text-xs">✕</span>
          </Button>
        </div>
      </div>

      {hasChildren && expanded && (
        <ul role="list">
          {node.children.map((child) => (
            <SpaceTreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

interface SpaceTreeProps {
  spaces: SpaceNode[];
  onAddRoot: () => void;
  onAddChild: (parentId: string) => void;
  onEdit: (node: SpaceNode) => void;
  onDelete: (node: SpaceNode) => void;
}

/**
 * Renders the full hierarchical space tree with add/edit/delete callbacks.
 *
 * Each root node is expanded by default; deeper nodes start collapsed.
 *
 * @param spaces - Root-level SpaceNode array with nested children.
 * @param onAddRoot - Called when the user wants to add a top-level space.
 * @param onAddChild - Called with a parent ID when adding a child space.
 * @param onEdit - Called with the SpaceNode to edit.
 * @param onDelete - Called with the SpaceNode to delete.
 */
export function SpaceTree({
  spaces,
  onAddRoot,
  onAddChild,
  onEdit,
  onDelete,
}: SpaceTreeProps) {
  if (spaces.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <Folder className="h-12 w-12 text-muted-foreground" />
        <div>
          <p className="font-medium">No spaces yet</p>
          <p className="text-sm text-muted-foreground">
            Create your first storage space to get started.
          </p>
        </div>
        <Button onClick={onAddRoot} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add space
        </Button>
      </div>
    );
  }

  return (
    <nav aria-label="Storage spaces">
      <div className="mb-2 flex items-center justify-between px-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Spaces
        </span>
        <Button variant="ghost" size="sm" onClick={onAddRoot} className="h-7 px-2">
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>
      <ul role="list" className="space-y-0.5">
        {spaces.map((node) => (
          <SpaceTreeNode
            key={node.id}
            node={node}
            depth={0}
            onAddChild={onAddChild}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </ul>
    </nav>
  );
}
