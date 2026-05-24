-- Migration: 001_create_spaces
-- Creates the spaces table for storing hierarchical storage locations.

CREATE TABLE IF NOT EXISTS spaces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL CHECK (char_length(name) > 0 AND char_length(name) <= 200),
  description TEXT CHECK (description IS NULL OR char_length(description) <= 2000),
  parent_id   UUID REFERENCES spaces(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS spaces_user_id_idx ON spaces(user_id);
CREATE INDEX IF NOT EXISTS spaces_parent_id_idx ON spaces(parent_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER spaces_updated_at
  BEFORE UPDATE ON spaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Full-text search index
ALTER TABLE spaces
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))
  ) STORED;

CREATE INDEX IF NOT EXISTS spaces_search_idx ON spaces USING gin(search_vector);
