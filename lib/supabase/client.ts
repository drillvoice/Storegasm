import { createBrowserClient } from "@supabase/ssr";

/**
 * Creates a Supabase client for use in browser (Client Components).
 *
 * Call this once per component tree — it is safe to call multiple times as
 * the underlying implementation is a singleton per set of credentials.
 *
 * @returns A configured SupabaseClient for browser use.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
