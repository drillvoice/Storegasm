import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Creates a Supabase client for use in Server Components, Route Handlers, and
 * Server Actions.
 *
 * Always create a new instance per server render — never share across requests.
 * If the current context cannot set cookies (e.g. a Server Component), token
 * refreshes are silently skipped; middleware handles those writes.
 *
 * @returns A configured SupabaseClient for server use.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Components cannot set cookies; middleware handles refresh.
          }
        },
      },
    }
  );
}
