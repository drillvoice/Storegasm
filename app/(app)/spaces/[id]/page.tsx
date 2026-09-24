import { redirect } from "next/navigation";
import { HydrationBoundary, dehydrate } from "@tanstack/react-query";
import { z } from "zod";
import { SpaceView } from "@/components/spaces/SpaceView";
import {
  getScopedEnvironmentId,
  makeServerQueryClient,
  prefetchItems,
  prefetchSpaceEnvironment,
  prefetchSpaceTree,
  prefetchTags,
} from "@/lib/server-data";
import { getSessionUserId } from "@/lib/session";

/**
 * Space page. Starts the environment's space tree, this space's items and the
 * tag list loading on the server, plus the lookup of which environment the
 * space is in — which is what lets SpaceView switch scope straight away when
 * the link leads into another environment.
 */
export default async function SpacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");

  const queryClient = makeServerQueryClient();
  // A malformed id names no space; let the client show that rather than send
  // the database a query it will reject.
  if (z.uuid().safeParse(id).success) {
    const environmentId = await getScopedEnvironmentId(userId);
    if (environmentId) {
      prefetchSpaceTree(queryClient, userId, environmentId);
      prefetchItems(queryClient, userId, environmentId, id);
      prefetchTags(queryClient, userId, environmentId);
    }
    prefetchSpaceEnvironment(queryClient, userId, id);
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <SpaceView id={id} />
    </HydrationBoundary>
  );
}
