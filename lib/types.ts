/**
 * Domain types for Storegasm.
 *
 * All database-level types are derived from these interfaces. Supabase query
 * results are cast to these types at the data-layer boundary (lib/db/).
 */

export interface Space {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

/** A Space node enriched with its resolved children for UI rendering. */
export interface SpaceNode extends Space {
  children: SpaceNode[];
}

export interface Item {
  id: string;
  user_id: string;
  space_id: string | null;
  name: string;
  description: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** An Item enriched with its parent space's name and breadcrumb path. */
export interface ItemWithSpace extends Item {
  space: Pick<Space, "id" | "name"> | null;
  /** Human-readable breadcrumb, e.g. "Bedroom > Under bed > Tub 1" */
  space_path: string | null;
}

/** Payload for creating a new space. */
export type CreateSpacePayload = Pick<Space, "name"> &
  Partial<Pick<Space, "description" | "parent_id">>;

/** Payload for updating an existing space. */
export type UpdateSpacePayload = Partial<
  Pick<Space, "name" | "description" | "parent_id">
>;

/** Payload for creating a new item. */
export type CreateItemPayload = Pick<Item, "name"> &
  Partial<Pick<Item, "description" | "space_id" | "tags">>;

/** Payload for updating an existing item. */
export type UpdateItemPayload = Partial<
  Pick<Item, "name" | "description" | "space_id" | "tags">
>;

/** Wraps every data-layer return in a discriminated union. */
export type DbResult<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string } };
