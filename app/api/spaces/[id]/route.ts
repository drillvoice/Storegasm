import { readRoute } from "@/lib/api/read-route";
import { fetchSpace } from "@/lib/db/spaces";
import { parseInput, spaceIdInput } from "@/lib/validation";

/**
 * One space, from any of the user's environments — how the space page finds
 * out which environment a link leads into. Null when there is no such space.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return readRoute(async (userId) => {
    // A malformed id can't name a space — answer "not found" like any other
    // unknown id, so a mangled URL lands on the page's not-found state.
    const spaceId = parseInput(spaceIdInput, id);
    if (spaceId.error) return { data: null, error: null };
    return fetchSpace(userId, spaceId.data);
  });
}
