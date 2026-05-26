"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Plus, MoreVertical, Pencil, Trash2, FolderPlus, Folder, X } from "lucide-react";
import { hierarchy, treemap, treemapSquarify } from "d3-hierarchy";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { SpaceNode } from "@/lib/types";

const PALETTE = [
  "#b45309",
  "#15803d",
  "#1d4ed8",
  "#7e22ce",
  "#b91c1c",
  "#c2410c",
  "#0f766e",
  "#be185d",
  "#3730a3",
  "#0e7490",
];

function countDescendants(node: SpaceNode): number {
  return 1 + node.children.reduce((sum, c) => sum + countDescendants(c), 0);
}

type HierarchyDatum = { space?: SpaceNode; children?: HierarchyDatum[] };

interface TileLayout {
  space: SpaceNode;
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  color: string;
}

function buildLayout(spaces: SpaceNode[], width: number, height: number): TileLayout[] {
  if (!spaces.length || width <= 0 || height <= 0) return [];

  const rootData: HierarchyDatum = {
    children: spaces.map((s) => ({ space: s })),
  };

  const root = treemap<HierarchyDatum>()
    .tile(treemapSquarify)
    .size([width, height])
    .paddingInner(2)
    .paddingOuter(0)(
    hierarchy<HierarchyDatum>(rootData, (d) => d.children).sum((d) =>
      d.space ? countDescendants(d.space) : 0
    )
  );

  return (root.children ?? []).map((node, i) => ({
    space: node.data.space!,
    x0: node.x0,
    y0: node.y0,
    x1: node.x1,
    y1: node.y1,
    color: PALETTE[i % PALETTE.length],
  }));
}

interface SpaceTreemapProps {
  spaces: SpaceNode[];
  onAddRoot: () => void;
  onAddChild: (parentId: string) => void;
  onEdit: (node: SpaceNode) => void;
  onDelete: (node: SpaceNode) => void;
}

export function SpaceTreemap({
  spaces,
  onAddRoot,
  onAddChild,
  onEdit,
  onDelete,
}: SpaceTreemapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ width: 0, height: 0 });
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [emptyDismissed, setEmptyDismissed] = useState(false);

  const measure = useCallback(() => {
    if (containerRef.current) {
      const { width, height } = containerRef.current.getBoundingClientRect();
      setDims({ width, height });
    }
  }, []);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  // Re-run when spaces becomes non-empty so we measure the newly-mounted container.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [measure, spaces.length]);

  if (spaces.length === 0) {
    if (emptyDismissed) return null;
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
        <Folder className="h-4 w-4 shrink-0" />
        <span className="flex-1">No spaces here yet.</span>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={onAddRoot}>
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Dismiss"
          onClick={() => setEmptyDismissed(true)}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }

  const tiles = buildLayout(spaces, dims.width, dims.height);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Spaces
        </span>
        <Button variant="ghost" size="sm" onClick={onAddRoot} className="h-7 px-2">
          <Plus className="mr-1 h-3 w-3" />
          Add
        </Button>
      </div>

      <div
        ref={containerRef}
        className="relative w-full overflow-hidden rounded-lg"
        style={{ minHeight: 360 }}
        aria-label="Storage spaces"
      >
        {dims.width === 0 ? (
          <div className="absolute inset-0 animate-pulse rounded-lg bg-muted" />
        ) : tiles.map((tile) => {
          const w = tile.x1 - tile.x0;
          const h = tile.y1 - tile.y0;
          const showLabel = w >= 60 && h >= 36;
          const showCount = w >= 80 && h >= 54;
          const showMenu = w >= 44;

          return (
            <div
              key={tile.space.id}
              className="absolute"
              style={{
                left: tile.x0,
                top: tile.y0,
                width: w,
                height: h,
                backgroundColor: tile.color,
              }}
            >
              <Link
                href={`/spaces/${tile.space.id}`}
                className="absolute inset-0 flex flex-col justify-end p-2"
                aria-label={tile.space.name}
              >
                {showLabel ? (
                  <>
                    <span
                      className="block truncate text-sm font-bold leading-tight text-white"
                      style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                    >
                      {tile.space.name}
                    </span>
                    {showCount && tile.space.children.length > 0 && (
                      <span
                        className="block text-xs leading-tight text-white/75"
                        style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                      >
                        {tile.space.children.length}{" "}
                        {tile.space.children.length === 1 ? "space" : "spaces"}
                      </span>
                    )}
                  </>
                ) : (
                  <span
                    className="block text-xs font-bold text-white"
                    style={{ textShadow: "0 1px 3px rgba(0,0,0,0.5)" }}
                  >
                    {tile.space.name
                      .split(" ")
                      .map((word) => word[0] ?? "")
                      .join("")
                      .toUpperCase()
                      .slice(0, 3)}
                  </span>
                )}
              </Link>

              {showMenu && (
                <div className="absolute right-1 top-1 z-10">
                  <Popover
                    open={openMenuId === tile.space.id}
                    onOpenChange={(open) =>
                      setOpenMenuId(open ? tile.space.id : null)
                    }
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 bg-black/25 text-white hover:bg-black/45"
                        aria-label={`Actions for ${tile.space.name}`}
                      >
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-44 p-1">
                      <button
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={() => {
                          setOpenMenuId(null);
                          onAddChild(tile.space.id);
                        }}
                      >
                        <FolderPlus className="h-4 w-4" />
                        Add space inside
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-accent"
                        onClick={() => {
                          setOpenMenuId(null);
                          onEdit(tile.space);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </button>
                      <button
                        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-sm text-destructive hover:bg-accent"
                        onClick={() => {
                          setOpenMenuId(null);
                          onDelete(tile.space);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </button>
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
