-- Migration: 003_rls_policies
-- Enables Row Level Security and creates policies so each user can only
-- access their own spaces and items.

-- ---- Grant table access to authenticated users ----
-- Required when tables are created via raw SQL rather than the Supabase UI.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.spaces TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.items TO authenticated;

-- ---- Spaces ----
ALTER TABLE spaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "spaces: select own" ON spaces
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "spaces: insert own" ON spaces
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "spaces: update own" ON spaces
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "spaces: delete own" ON spaces
  FOR DELETE USING (auth.uid() = user_id);

-- ---- Items ----
ALTER TABLE items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "items: select own" ON items
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "items: insert own" ON items
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "items: update own" ON items
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "items: delete own" ON items
  FOR DELETE USING (auth.uid() = user_id);
