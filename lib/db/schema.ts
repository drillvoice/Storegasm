/**
 * Drizzle schema for Storegasm on Neon Postgres.
 *
 * Two groups of tables:
 *  - Better Auth tables (user, session, account, verification) — shapes match
 *    what `npx @better-auth/cli generate` emits for the Drizzle adapter.
 *  - App tables (spaces, items) — ported from supabase/migrations 001/002.
 *    Per-user isolation is enforced in the data layer (every query filters by
 *    user_id from the server session); there are no RLS policies here.
 *
 * The items.search_vector column is trigger-maintained (see the custom SQL
 * migration) because array_to_string() is not immutable, which generated
 * columns require. The spaces.search_vector column IS a generated column.
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  customType,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// ---------------------------------------------------------------------------
// Better Auth tables
// ---------------------------------------------------------------------------

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_id_idx").on(t.userId)]
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      withTimezone: true,
    }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("account_user_id_idx").on(t.userId)]
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ---------------------------------------------------------------------------
// App tables
// ---------------------------------------------------------------------------

// Timestamps use mode: "string" so rows serialize across the server-action
// boundary and match the ISO-string fields in lib/types.ts.

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    parent_id: uuid("parent_id").references((): AnyPgColumn => spaces.id, {
      onDelete: "cascade",
    }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    search_vector: tsvector("search_vector").generatedAlwaysAs(
      sql`to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))`
    ),
  },
  (t) => [
    index("spaces_user_id_idx").on(t.user_id),
    index("spaces_parent_id_idx").on(t.parent_id),
    index("spaces_search_idx").using("gin", t.search_vector),
    check(
      "spaces_name_length",
      sql`char_length(name) > 0 AND char_length(name) <= 200`
    ),
    check(
      "spaces_description_length",
      sql`description IS NULL OR char_length(description) <= 2000`
    ),
  ]
);

export const items = pgTable(
  "items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    space_id: uuid("space_id").references(() => spaces.id, {
      onDelete: "set null",
    }),
    name: text("name").notNull(),
    description: text("description"),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    // Maintained by the items_search_vector_trigger (custom SQL migration).
    search_vector: tsvector("search_vector"),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("items_user_id_idx").on(t.user_id),
    index("items_space_id_idx").on(t.space_id),
    index("items_tags_idx").using("gin", t.tags),
    index("items_search_idx").using("gin", t.search_vector),
    check(
      "items_name_length",
      sql`char_length(name) > 0 AND char_length(name) <= 200`
    ),
    check(
      "items_description_length",
      sql`description IS NULL OR char_length(description) <= 2000`
    ),
  ]
);
