-- Migration: 002_create_items
-- Creates the items table for storing objects assigned to storage spaces.

CREATE TABLE IF NOT EXISTS items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  space_id      UUID REFERENCES spaces(id) ON DELETE SET NULL,
  name          TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 200),
  description   TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  tags          TEXT[] NOT NULL DEFAULT '{}',
  search_vector tsvector,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS items_user_id_idx ON items(user_id);
CREATE INDEX IF NOT EXISTS items_space_id_idx ON items(space_id);
CREATE INDEX IF NOT EXISTS items_tags_idx ON items USING gin(tags);
CREATE INDEX IF NOT EXISTS items_search_idx ON items USING gin(search_vector);

-- Auto-update updated_at
CREATE TRIGGER items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Trigger to keep search_vector in sync on every insert/update.
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

CREATE TRIGGER items_search_vector_trigger
  BEFORE INSERT OR UPDATE ON items
  FOR EACH ROW EXECUTE FUNCTION items_search_vector_update();
