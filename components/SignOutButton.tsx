"use client";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

/**
 * Signs the user out client-side, clears the React Query cache (in-memory and
 * its persisted localStorage copy) so no inventory data is left behind on a
 * shared device, then returns to the login page.
 */
export function SignOutButton() {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await authClient.signOut();
    queryClient.clear();
    try {
      localStorage.removeItem("sg:rq");
    } catch {
      // localStorage unavailable — nothing to clear.
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Sign out"
      onClick={handleSignOut}
    >
      <LogOut className="h-4 w-4" />
    </Button>
  );
}
