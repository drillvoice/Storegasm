import { invalid, readRoute } from "@/lib/api/read-route";
import { searchItems } from "@/lib/db/items";
import {
  environmentIdInput,
  parseInput,
  searchQueryInput,
} from "@/lib/validation";

/**
 * Full-text item search: `?q=<words>`, scoped with `&environment=<id>`, or
 * across every environment without it.
 */
export function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  return readRoute(async (userId) => {
    const q = parseInput(searchQueryInput, params.get("q") ?? "");
    if (q.error) return invalid(q.error);
    const envId = parseInput(
      environmentIdInput.nullable(),
      params.get("environment")
    );
    if (envId.error) return invalid(envId.error);
    return searchItems(userId, envId.data, q.data);
  });
}
