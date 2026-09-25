import { invalid, readRoute } from "@/lib/api/read-route";
import { countEnvironmentContents } from "@/lib/db/environments";
import { environmentIdInput, parseInput } from "@/lib/validation";

/**
 * How many spaces and items an environment holds — what deleting it would
 * destroy, shown in the confirmation first.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  return readRoute(async (userId) => {
    const envId = parseInput(environmentIdInput, id);
    if (envId.error) return invalid(envId.error);
    return countEnvironmentContents(userId, envId.data);
  });
}
