import { invalid, readRoute } from "@/lib/api/read-route";
import { fetchAllTags } from "@/lib/db/items";
import { environmentIdInput, parseInput } from "@/lib/validation";

/** Every distinct tag on an environment's items, sorted. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return readRoute(async (userId) => {
    const envId = parseInput(environmentIdInput, id);
    if (envId.error) return invalid(envId.error);
    return fetchAllTags(userId, envId.data);
  });
}
