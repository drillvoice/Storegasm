-- Moves the environment rules from application code into the database.
--
-- Until now lib/db enforced three invariants by checking before it wrote:
-- a space or item is in an environment its owner owns, a space's parent is in
-- the same environment, and an item is in its space's environment. Composite
-- foreign keys state the same rules so no write can break them — and the two
-- that point at spaces cascade on update, so changing a space's environment_id
-- carries its subtree and items along without a hand-written recursive query.
--
-- Hand-edited after `drizzle-kit generate`: the generated version added the
-- foreign keys before the unique constraints they reference, and a database
-- holding any row that already breaks a rule would refuse the new keys. The
-- repairs below put such rows right first, so the migration applies cleanly
-- to any existing data.

-- The unique pairs the composite keys point at.
ALTER TABLE "environments" ADD CONSTRAINT "environments_id_user_id_unique" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_id_environment_id_unique" UNIQUE("id","environment_id");--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Repairs. Each only touches rows that already break a rule, which nothing
-- the app's own UI does; on a healthy database every statement matches zero
-- rows.
-- ---------------------------------------------------------------------------

-- 1. Anyone who owns a space or item but no environment gets a default one,
--    so the next steps have somewhere to put their rows.
INSERT INTO "environments" ("user_id", "name")
SELECT DISTINCT r."user_id", 'My Home'
FROM (
  SELECT "user_id" FROM "spaces"
  UNION
  SELECT "user_id" FROM "items"
) r
WHERE NOT EXISTS (
  SELECT 1 FROM "environments" e WHERE e."user_id" = r."user_id"
);--> statement-breakpoint

-- 2. Rows sitting in someone else's environment move to their owner's oldest
--    environment.
UPDATE "spaces" s SET "environment_id" = (
  SELECT e."id" FROM "environments" e
  WHERE e."user_id" = s."user_id"
  ORDER BY e."created_at", e."id" LIMIT 1
)
WHERE NOT EXISTS (
  SELECT 1 FROM "environments" e
  WHERE e."id" = s."environment_id" AND e."user_id" = s."user_id"
);--> statement-breakpoint
UPDATE "items" i SET "environment_id" = (
  SELECT e."id" FROM "environments" e
  WHERE e."user_id" = i."user_id"
  ORDER BY e."created_at", e."id" LIMIT 1
)
WHERE NOT EXISTS (
  SELECT 1 FROM "environments" e
  WHERE e."id" = i."environment_id" AND e."user_id" = i."user_id"
);--> statement-breakpoint

-- 3. A space whose parent is in another environment moves to the top level of
--    its own.
UPDATE "spaces" s SET "parent_id" = NULL
FROM "spaces" p
WHERE p."id" = s."parent_id" AND p."environment_id" <> s."environment_id";--> statement-breakpoint

-- 4. An item assigned to another user's space is unassigned; an item whose
--    environment disagrees with its space's follows the space, as moving an
--    item into a space does in the app.
UPDATE "items" i SET "space_id" = NULL
FROM "spaces" s
WHERE s."id" = i."space_id" AND s."user_id" <> i."user_id";--> statement-breakpoint
UPDATE "items" i SET "environment_id" = s."environment_id"
FROM "spaces" s
WHERE s."id" = i."space_id" AND s."environment_id" <> i."environment_id";--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- The keys. Each composite key replaces the single-column one it subsumes.
-- items.space_id keeps its own key: that is what unassigns items when their
-- space is deleted (ON DELETE SET NULL), which a composite key can't do
-- without also nulling environment_id.
-- ---------------------------------------------------------------------------

ALTER TABLE "spaces" DROP CONSTRAINT "spaces_environment_id_environments_id_fk";--> statement-breakpoint
ALTER TABLE "spaces" DROP CONSTRAINT "spaces_parent_id_spaces_id_fk";--> statement-breakpoint
ALTER TABLE "items" DROP CONSTRAINT "items_environment_id_environments_id_fk";--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_environment_owner_fk" FOREIGN KEY ("environment_id","user_id") REFERENCES "public"."environments"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spaces" ADD CONSTRAINT "spaces_parent_same_environment_fk" FOREIGN KEY ("parent_id","environment_id") REFERENCES "public"."spaces"("id","environment_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_environment_owner_fk" FOREIGN KEY ("environment_id","user_id") REFERENCES "public"."environments"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_space_same_environment_fk" FOREIGN KEY ("space_id","environment_id") REFERENCES "public"."spaces"("id","environment_id") ON DELETE no action ON UPDATE cascade;--> statement-breakpoint

-- environments never got the updated_at trigger spaces and items have, so its
-- updated_at stayed at the creation time through every rename and archive.
CREATE TRIGGER environments_updated_at
  BEFORE UPDATE ON environments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
