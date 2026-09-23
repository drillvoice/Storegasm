import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { SpaceNode } from "@/lib/types";

/**
 * Merges Tailwind CSS class names, resolving conflicts intelligently.
 *
 * @param inputs - Any number of class value arguments (strings, arrays, objects).
 * @returns A single merged class name string.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Flattens a SpaceNode tree into select options, each carrying its nesting depth for indentation. */
export function flattenSpaces(
  nodes: SpaceNode[],
  depth = 0
): Array<{ id: string; label: string; depth: number }> {
  return nodes.flatMap((n) => [
    { id: n.id, label: n.name, depth },
    ...flattenSpaces(n.children, depth + 1),
  ]);
}

/**
 * Collects the IDs of a space and all its descendants.
 *
 * Used to exclude a subtree from destination pickers — a space can't be moved
 * inside itself or anything it contains.
 */
export function collectSubtreeIds(
  nodes: SpaceNode[],
  targetId: string
): Set<string> {
  const ids = new Set<string>();
  const collect = (node: SpaceNode) => {
    ids.add(node.id);
    node.children.forEach(collect);
  };
  const find = (candidates: SpaceNode[]) => {
    for (const n of candidates) {
      if (n.id === targetId) {
        collect(n);
        return;
      }
      find(n.children);
    }
  };
  find(nodes);
  return ids;
}
