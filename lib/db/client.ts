import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

/**
 * Drizzle client over Neon's HTTP driver.
 *
 * neon-http is stateless per query (no connection management), which fits
 * this app: every data operation is a single statement or independent
 * parallel statements. If interactive transactions are ever needed, switch
 * to drizzle-orm/neon-serverless with a WebSocket Pool.
 *
 * The client is created lazily on first query rather than at import time, so
 * `next build` (which imports route modules to collect page data) works
 * without DATABASE_URL being set.
 */
type Db = ReturnType<typeof drizzle<typeof schema>>;

let cached: Db | undefined;

export const db = new Proxy({} as Db, {
  get(_target, prop) {
    cached ??= drizzle(neon(process.env.DATABASE_URL!), { schema });
    return Reflect.get(cached, prop);
  },
});
