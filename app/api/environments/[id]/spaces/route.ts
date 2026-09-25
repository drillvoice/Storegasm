import { invalid, readRoute } from "@/lib/api/read-route";
import { fetchSpaceTree } from "@/lib/db/spaces";
import { environmentIdInput, parseInput } from "@/lib/validation";

/** An environment's space tree. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return readRoute(async (userId) => {
    const envId = parseInput(environmentIdInput, id);
    if (envId.error) return invalid(envId.error);
    return fetchSpaceTree(userId, envId.data);
  });
}
