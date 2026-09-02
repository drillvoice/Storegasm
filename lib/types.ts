/**
 * Domain types for Storegasm.
 *
 * All database-level types are derived from these interfaces. Query results
 * are cast to these types at the data-layer boundary (lib/db/).
 */

/**
 * A place that owns a space tree — a house, an office, a studio.
 *
 * Environments are the app's second tenancy axis: `user_id` says who owns a
 * row, `environment_id` says where it is. Every space and item belongs to
 * exactly one, and the dashboard, search and pickers show one at a time.
 */
export interface Environment {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  /** Null when active. Archived environments are hidden from the switcher. */
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Space {
  id: string;
  user_id: string;
  environment_id: string;
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
  /**
   * Always equal to the environment of `space_id`'s space. For unassigned
   * items (space_id null) it is the environment the item was created in or
   * last moved to. Derived server-side — never supplied by the client.
   */
  environment_id: string;
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
  /**
   * The item's environment. Populated so a search spanning every environment
   * can say which place each result is in; null-safe for scoped searches.
   */
  environment: Pick<Environment, "id" | "name"> | null;
}

/** Payload for creating a new environment. */
export type CreateEnvironmentPayload = Pick<Environment, "name"> &
  Partial<Pick<Environment, "description">>;

/** Payload for updating an environment. Set `archived_at` to null to restore. */
export type UpdateEnvironmentPayload = Partial<
  Pick<Environment, "name" | "description" | "archived_at">
>;

/** Payload for creating a new space. */
export type CreateSpacePayload = Pick<Space, "name"> &
  Partial<Pick<Space, "description" | "parent_id">>;

/** Payload for updating an existing space. */
export type UpdateSpacePayload = Partial<
  Pick<Space, "name" | "description" | "parent_id">
>;

/**
 * Destination for moving a space (and everything under it) to another
 * environment. `parent_id` null puts it at the top level of that environment.
 */
export interface MoveSpacePayload {
  environment_id: string;
  parent_id: string | null;
}

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
