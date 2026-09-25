/**
 * Harness for the integration tests: the real data layer against a real,
 * migrated Postgres.
 *
 * Set TEST_DATABASE_URL to a database that `npm run db:migrate` has been run
 * against; without it the integration suites are skipped. CI provides one
 * (.github/workflows/ci.yml). Tests truncate the tables they use, so never
 * point this at a database you care about.
 *
 * Production talks to Neon over its HTTP driver, which needs Neon's endpoint;
 * here the same Drizzle schema runs over node-postgres instead. The SQL the
 * data layer generates is the same either way. neon-http's db.batch() — one
 * transaction per call — is reproduced with an explicit transaction.
 */
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/lib/db/schema";

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;

export function connect() {
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  const db = drizzle(pool, { schema });

  const batch = async (queries: unknown[]) => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const tx = drizzle(client, { schema });
      const results = [];
      for (const query of queries) {
        results.push(await tx.execute(query as Parameters<typeof tx.execute>[0]));
      }
      await client.query("COMMIT");
      return results;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  };

  return { pool, db: Object.assign(db, { batch }) };
}

/** Creates a user row and returns its id. */
export async function createUser(pool: Pool, id: string): Promise<string> {
  await pool.query(
    `INSERT INTO "user" (id, name, email) VALUES ($1, $1, $1 || '@test.local')`,
    [id]
  );
  return id;
}
