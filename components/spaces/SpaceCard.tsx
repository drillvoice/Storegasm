import Link from "next/link";
import { Folder, ChevronRight } from "lucide-react";
import type { Space } from "@/lib/types";

interface SpaceCardProps {
  space: Space;
}

/**
 * A compact card linking to a child space.
 *
 * Used in the space detail page to display direct children.
 *
 * @param space - The Space record to display.
 */
export function SpaceCard({ space }: SpaceCardProps) {
  return (
    <Link
      href={`/spaces/${space.id}`}
      className="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 hover:bg-accent transition-colors"
    >
      <Folder className="h-5 w-5 shrink-0 text-primary" aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{space.name}</p>
        {space.description && (
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {space.description}
          </p>
        )}
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
