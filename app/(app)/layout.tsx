import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Search, LogOut } from "lucide-react";

/**
 * Authenticated app shell layout.
 *
 * Verifies the user session server-side and redirects to /login if no session
 * exists. Renders the top nav (search link + sign-out) around all child pages.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="font-semibold tracking-tight">
            Storegasm
          </Link>

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/search">
                <Search className="mr-2 h-4 w-4" />
                Search
              </Link>
            </Button>

            <form action="/auth/signout" method="POST">
              <Button variant="ghost" size="icon" aria-label="Sign out" formAction={signOutAction}>
                <LogOut className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}

/**
 * Server Action that signs the user out and redirects to /login.
 */
async function signOutAction() {
  "use server";
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
