"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { clearCache } from "@/lib/cache";
import { Button } from "@/components/ui/button";

/**
 * Signs the user out client-side, clears the localStorage cache so no inventory
 * data is left behind on a shared device, then returns to the login page.
 */
export function SignOutButton() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    clearCache();
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
