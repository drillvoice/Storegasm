-- Custom migration: triggers ported from supabase/migrations 001/002.
-- Drizzle's schema DSL can't express these, so they live here.

-- Auto-update updated_at on spaces and items.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
--> statement-breakpoint
-- Keep items.search_vector in sync on every insert/update.
-- Uses a trigger (not a generated column) because array_to_string() is not
-- considered immutable by Postgres, which generated columns require.
CREATE OR REPLACE FUNCTION items_search_vector_update()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('english',
    coalesce(NEW.name, '') || ' ' ||
    coalesce(NEW.description, '') || ' ' ||
    coalesce(array_to_string(NEW.tags, ' '), '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER items_search_vector_trigger
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION items_search_vector_update();
