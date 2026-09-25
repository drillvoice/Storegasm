import { redirect } from "next/navigation";
import Link from "next/link";
import { getEnvironments, getSelectedEnvironmentId } from "@/lib/server-data";
import { getSession } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/AppShell";
import { EnvironmentSwitcher } from "@/components/environments/EnvironmentSwitcher";
import { InstallPrompt } from "@/components/InstallPrompt";
import { SignOutButton } from "@/components/SignOutButton";
import { Search } from "lucide-react";

/**
 * Authenticated app shell layout.
 *
 * Verifies the user session server-side and redirects to /login if no session
 * exists. Renders the top nav (environment switcher + search link + sign-out)
 * around all child pages.
 *
 * Also loads the environment list and reads the remembered selection, so the
 * switcher renders with the right name in the server's HTML and every page's
 * data hooks have an environment to key on from their first render.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  if (!session) redirect("/login");

  const userId = session.user.id;
  const [environments, selectedId] = await Promise.all([
    getEnvironments(userId),
    getSelectedEnvironmentId(),
  ]);

  return (
    <AppShell
      userId={userId}
      initialEnvironments={environments.error ? null : environments.data}
      initialEnvironmentId={selectedId}
    >
      <div className="flex min-h-screen flex-col">
        <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
            <div className="flex min-w-0 items-center gap-1">
              <Link
                href="/dashboard"
                className="hidden font-semibold tracking-tight sm:block"
              >
                Storegasm
              </Link>
              <EnvironmentSwitcher />
            </div>

            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/search">
                  <Search className="mr-2 h-4 w-4" />
                  Search
                </Link>
              </Button>

              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
          {children}
        </main>

        <footer className="border-t border-border py-3">
          <div className="mx-auto max-w-5xl px-4 text-right">
            <span className="text-xs text-muted-foreground/50 select-none">
              v{process.env.NEXT_PUBLIC_APP_VERSION}
            </span>
          </div>
        </footer>

        <InstallPrompt />
      </div>
    </AppShell>
  );
}
