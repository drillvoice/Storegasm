import { redirect } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { DashboardView } from "@/components/dashboard/DashboardView";
import {
  getScopedEnvironmentId,
  makeServerQueryClient,
  prefetchItems,
  prefetchSpaceTree,
  prefetchTags,
} from "@/lib/server-data";
import { getSessionUserId } from "@/lib/session";

/**
 * Dashboard page. Starts the space tree, unassigned items and tag list loading
 * on the server — in parallel, and without waiting for them — and streams them
 * to DashboardView's hooks.
 */
export default async function DashboardPage() {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const queryClient = makeServerQueryClient();
  const environmentId = await getScopedEnvironmentId(userId);
  if (environmentId) {
    prefetchSpaceTree(queryClient, userId, environmentId);
    prefetchItems(queryClient, userId, environmentId, null);
    prefetchTags(queryClient, userId, environmentId);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <DashboardView />
    </HydrationBoundary>
  );
}
