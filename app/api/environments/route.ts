import { readRoute } from "@/lib/api/read-route";
import { ensureDefaultEnvironment } from "@/lib/db/environments";

/**
 * The user's environments, archived ones included. Creates the default one
 * for an account that has none, so the client always has a scope to work in.
 */
export function GET() {
  return readRoute((userId) => ensureDefaultEnvironment(userId));
}
