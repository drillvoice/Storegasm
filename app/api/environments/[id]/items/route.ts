import { invalid, readRoute } from "@/lib/api/read-route";
import { fetchItemsBySpace, fetchUnassignedItems } from "@/lib/db/items";
import { environmentIdInput, parseInput, spaceIdInput } from "@/lib/validation";

/**
 * The items in one space of an environment (`?space=<id>`), or the
 * environment's unassigned items when no space is given.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const space = new URL(request.url).searchParams.get("space");
  return readRoute(async (userId) => {
    const envId = parseInput(environmentIdInput, id);
    if (envId.error) return invalid(envId.error);
    if (space === null) return fetchUnassignedItems(userId, envId.data);
    // A malformed space id can't hold anything — answer with an empty list,
    // as for any other unknown space, so a mangled URL shows an empty page.
    const spaceId = parseInput(spaceIdInput, space);
    if (spaceId.error) return { data: [], error: null };
    return fetchItemsBySpace(userId, envId.data, spaceId.data);
  });
}
