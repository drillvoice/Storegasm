import { redirect } from "next/navigation";

/**
 * Root page — redirects authenticated users to the dashboard.
 * Unauthenticated users are caught by middleware and sent to /login.
 */
export default function RootPage() {
  redirect("/dashboard");
}
