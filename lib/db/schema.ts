/**
 * Drizzle schema for Storegasm on Neon Postgres.
 *
 * Two groups of tables:
 *  - Better Auth tables (user, session, account, verification) — shapes match
 *    what `npx @better-auth/cli generate` emits for the Drizzle adapter.
 *  - App tables (environments, spaces, items). Per-user isolation is enforced
 *    in the data layer (every query filters by user_id from the server
 *    session); there are no RLS policies here.
 *
 * An environment is a place that owns a space tree — a house, an office, a
 * studio. environment_id is denormalised onto spaces AND items so every scoped
 * query is a plain indexed filter rather than an ancestor walk. The rules that
 * keep the copies honest are composite foreign keys, so the database refuses
 * to break them whatever the code does:
 *  - (environment_id, user_id) → environments(id, user_id): a space or item
 *    can only sit in an environment its owner owns.
 *  - spaces (parent_id, environment_id) → spaces(id, environment_id): a
 *    space's parent is in the same environment.
 *  - items (space_id, environment_id) → spaces(id, environment_id): an item is
 *    in its space's environment (unassigned items keep the one they were in).
 * The last two cascade on update, so changing one space's environment_id
 * carries its whole subtree and every item inside it along.
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
  foreignKey,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
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

export const environments = pgTable(
  "environments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
    // Null means active. Archiving hides an environment from the switcher
    // without destroying its contents — the soft alternative to deleting.
    archived_at: timestamp("archived_at", {
      withTimezone: true,
      mode: "string",
    }),
    created_at: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("environments_user_id_idx").on(t.user_id),
    // Target of the (environment_id, user_id) foreign keys below.
    unique("environments_id_user_id_unique").on(t.id, t.user_id),
    check(
      "environments_name_length",
      sql`char_length(name) > 0 AND char_length(name) <= 200`
    ),
    check(
      "environments_description_length",
      sql`description IS NULL OR char_length(description) <= 2000`
    ),
  ]
);

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    user_id: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    environment_id: uuid("environment_id").notNull(),
    name: text("name").notNull(),
    description: text("description"),
    parent_id: uuid("parent_id"),
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
    // Target of the (…, environment_id) foreign keys from child spaces and items.
    unique("spaces_id_environment_id_unique").on(t.id, t.environment_id),
    foreignKey({
      name: "spaces_environment_owner_fk",
      columns: [t.environment_id, t.user_id],
      foreignColumns: [environments.id, environments.user_id],
    }).onDelete("cascade"),
    foreignKey({
      name: "spaces_parent_same_environment_fk",
      columns: [t.parent_id, t.environment_id],
      foreignColumns: [t.id, t.environment_id],
    })
      .onDelete("cascade")
      .onUpdate("cascade"),
    index("spaces_user_id_idx").on(t.user_id),
    index("spaces_environment_id_idx").on(t.environment_id),
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
    environment_id: uuid("environment_id").notNull(),
    // Deleting a space unassigns its items rather than deleting them. This
    // single-column key does that; the composite key below only checks that
    // the environments agree (and follows a space that moves).
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
    foreignKey({
      name: "items_environment_owner_fk",
      columns: [t.environment_id, t.user_id],
      foreignColumns: [environments.id, environments.user_id],
    }).onDelete("cascade"),
    foreignKey({
      name: "items_space_same_environment_fk",
      columns: [t.space_id, t.environment_id],
      foreignColumns: [spaces.id, spaces.environment_id],
    }).onUpdate("cascade"),
    index("items_user_id_idx").on(t.user_id),
    index("items_environment_id_idx").on(t.environment_id),
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
