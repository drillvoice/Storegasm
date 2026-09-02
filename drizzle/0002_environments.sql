-- Introduces environments: a named place (a house, an office, a studio) that
-- owns a space tree. environment_id is denormalised onto both spaces and items.
--
-- Hand-edited after `drizzle-kit generate`: the generated version added the
-- NOT NULL columns in one step, which fails on any database that already has
-- rows. The backfill below is interleaved so existing data lands in a default
-- "My Home" environment, one per user, before the constraint is applied.

CREATE TABLE "environments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "environments_name_length" CHECK (char_length(name) > 0 AND char_length(name) <= 200),
	CONSTRAINT "environments_description_length" CHECK (description IS NULL OR char_length(description) <= 2000)
);
--> statement-breakpoint
ALTER TABLE "environments" ADD CONSTRAINT "environments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "environments_user_id_idx" ON "environments" USING btree ("user_id");--> statement-breakpoint

-- Every existing account gets exactly one environment to hold what it already
-- has. Accounts created after this migration get theirs from
-- ensureDefaultEnvironment() in lib/db/environments.ts.
INSERT INTO "environments" ("user_id", "name")
SELECT "id", 'My Home' FROM "user";--> statement-breakpoint

-- Added nullable, backfilled, then constrained.
ALTER TABLE "spaces" ADD COLUMN "environment_id" uuid;--> statement-breakpoint
ALTER TABLE "items" ADD COLUMN "environment_id" uuid;--> statement-breakpoint

-- The updated_at triggers from 0001 would stamp now() on every row during the
-- backfill, destroying real edit timestamps. Suspend them for the rewrite.
ALTER TABLE "spaces" DISABLE TRIGGER "spaces_updated_at";--> statement-breakpoint
ALTER TABLE "items" DISABLE TRIGGER "items_updated_at";--> statement-breakpoint

-- Exactly one environment per user exists at this point, so the join is
-- unambiguous.
UPDATE "spaces" s SET "environment_id" = e."id"
FROM "environments" e WHERE e."user_id" = s."user_id";--> statement-breakpoint
UPDATE "items" i SET "environment_id" = e."id"
FROM "environments" e WHERE e."user_id" = i."user_id";--> statement-breakpoint

ALTER TABLE "spaces" ENABLE TRIGGER "spaces_updated_at";--> statement-breakpoint
ALTER TABLE "items" ENABLE TRIGGER "items_updated_at";--> statement-breakpoint

ALTER TABLE "spaces" ALTER COLUMN "environment_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "items" ALTER COLUMN "environment_id" SET NOT NULL;--> statement-breakpoint

ALTER TABLE "spaces" ADD CONSTRAINT "spaces_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "items" ADD CONSTRAINT "items_environment_id_environments_id_fk" FOREIGN KEY ("environment_id") REFERENCES "public"."environments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "spaces_environment_id_idx" ON "spaces" USING btree ("environment_id");--> statement-breakpoint
CREATE INDEX "items_environment_id_idx" ON "items" USING btree ("environment_id");
