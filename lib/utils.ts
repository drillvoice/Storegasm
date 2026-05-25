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

/** Flattens a SpaceNode tree into depth-indented options for a select dropdown. */
export function flattenSpaces(
  nodes: SpaceNode[],
  depth = 0
): Array<{ id: string; label: string }> {
  return nodes.flatMap((n) => [
    { id: n.id, label: "  ".repeat(depth) + n.name },
    ...flattenSpaces(n.children, depth + 1),
  ]);
}
