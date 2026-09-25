/**
 * Runtime validation for everything a server action accepts from the client.
 *
 * Server actions are public HTTP endpoints: the TypeScript payload types in
 * lib/types.ts describe what the app's own UI sends, but nothing stops a
 * hand-made request from sending something else. Before this, the update
 * actions passed the payload straight to Drizzle's `.set()`, which writes any
 * key that names a column — so `{ user_id: "…" }` handed a row to another
 * account and `{ environment_id: "…" }` moved a space without its subtree.
 *
 * So every action parses its arguments here first. Object schemas are strict:
 * an unexpected key is rejected rather than silently dropped, because the only
 * way to send one is to bypass the UI. Length limits mirror the CHECK
 * constraints in lib/db/schema.ts so the message is a readable one rather than
 * a constraint name.
 */

import { z } from "zod";

const id = z.uuid({ message: "Invalid id" });

const name = z
  .string()
  .min(1, "Name is required")
  .max(200, "Name must be 200 characters or fewer");

const description = z
  .string()
  .max(2000, "Description must be 2000 characters or fewer")
  .nullable();

const tags = z
  .array(z.string().min(1).max(100, "Tags must be 100 characters or fewer"))
  .max(200, "An item can have at most 200 tags");

// ---------------------------------------------------------------------------
// Environments
// ---------------------------------------------------------------------------

export const environmentIdInput = id;

export const createEnvironmentInput = z.strictObject({
  name,
  description: description.optional(),
});

export const updateEnvironmentInput = z.strictObject({
  name: name.optional(),
  description: description.optional(),
  archived_at: z.iso.datetime({ offset: true }).nullable().optional(),
});

// ---------------------------------------------------------------------------
// Spaces
// ---------------------------------------------------------------------------

export const spaceIdInput = id;

export const createSpaceInput = z.strictObject({
  name,
  description: description.optional(),
  parent_id: id.nullable().optional(),
});

export const updateSpaceInput = z.strictObject({
  name: name.optional(),
  description: description.optional(),
  parent_id: id.nullable().optional(),
});

export const moveSpaceInput = z.strictObject({
  environment_id: id,
  parent_id: id.nullable(),
});

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export const itemIdInput = id;

export const createItemInput = z.strictObject({
  name,
  description: description.optional(),
  space_id: id.nullable().optional(),
  tags: tags.optional(),
});

export const updateItemInput = z.strictObject({
  name: name.optional(),
  description: description.optional(),
  space_id: id.nullable().optional(),
  tags: tags.optional(),
});

export const searchQueryInput = z
  .string()
  .max(200, "Search must be 200 characters or fewer");

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

type Parsed<T> =
  | { data: T; error: null }
  | { data: null; error: { message: string } };

/**
 * Parses one action argument, returning the data layer's `{ data, error }`
 * shape so a failure can be returned from the action as-is.
 *
 * @param schema - The schema the argument must satisfy.
 * @param value - The raw argument as received from the client.
 * @returns The parsed value, or an error naming the first problem found.
 */
export function parseInput<T>(schema: z.ZodType<T>, value: unknown): Parsed<T> {
  const result = schema.safeParse(value);
  if (result.success) return { data: result.data, error: null };
  const issue = result.error.issues[0];
  const path = issue?.path.length ? `${issue.path.join(".")}: ` : "";
  return {
    data: null,
    error: { message: `Invalid input — ${path}${issue?.message ?? "rejected"}` },
  };
}
