import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mocks the Drizzle db client with a thenable query chain. Results are keyed
 * by the schema table passed to from()/insert()/update()/delete(); queueByTable
 * answers each call to the same table differently, for the functions that read
 * it more than once.
 */
const h = vi.hoisted(() => {
  const state = {
    resultsByTable: new Map<unknown, unknown[]>(),
    queueByTable: new Map<unknown, unknown[][]>(),
    error: null as Error | null,
    inserted: [] as Record<string, unknown>[],
    updated: [] as Record<string, unknown>[],
    deleted: 0,
    batches: [] as unknown[][],
  };

  function makeChain(initialTable?: unknown) {
    let table = initialTable;
    const chain: Record<string, unknown> = {};
    for (const m of ["select", "where", "orderBy", "limit", "returning"]) {
      chain[m] = () => chain;
    }
    chain.from = (t: unknown) => {
      table = t;
      return chain;
    };
    chain.set = (v: Record<string, unknown>) => {
      state.updated.push(v);
      return chain;
    };
    chain.values = (v: Record<string, unknown>) => {
      state.inserted.push(v);
      return chain;
    };
    chain.then = (
      resolve: (v: unknown) => void,
      reject: (e: Error) => void
    ) => {
      if (state.error) return reject(state.error);
      const queue = state.queueByTable.get(table);
      if (queue && queue.length > 0) return resolve(queue.shift());
      return resolve(state.resultsByTable.get(table) ?? []);
    };
    return chain;
  }

  const db = {
    select: () => makeChain(),
    insert: (t: unknown) => makeChain(t),
    update: (t: unknown) => makeChain(t),
    delete: (t: unknown) => {
      state.deleted++;
      return makeChain(t);
    },
    // ensureDefaultEnvironment's locked insert.
    execute: (q: unknown) => q,
    batch: (queries: unknown[]) => {
      state.batches.push(queries);
      if (state.error) return Promise.reject(state.error);
      return Promise.resolve([]);
    },
  };

  return { state, db };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: h.db }));

import {
  fetchEnvironments,
  ensureDefaultEnvironment,
  createEnvironment,
  updateEnvironment,
  deleteEnvironment,
} from "@/lib/db/environments";
import { environments } from "@/lib/db/schema";

const USER_ID = "user-123";
const ENV_ID = "env-1";

function makeEnvironment(overrides: Record<string, unknown> = {}) {
  return {
    id: ENV_ID,
    user_id: USER_ID,
    name: "My Home",
    description: null,
    archived_at: null,
    created_at: "",
    updated_at: "",
    ...overrides,
  };
}

beforeEach(() => {
  h.state.resultsByTable = new Map();
  h.state.queueByTable = new Map();
  h.state.error = null;
  h.state.inserted = [];
  h.state.updated = [];
  h.state.deleted = 0;
  h.state.batches = [];
});

describe("fetchEnvironments", () => {
  it("returns the user's environments", async () => {
    const env = makeEnvironment();
    h.state.resultsByTable.set(environments, [env]);

    const result = await fetchEnvironments(USER_ID);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([env]);
  });

  it("propagates database errors", async () => {
    h.state.error = new Error("DB error");

    const result = await fetchEnvironments(USER_ID);

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("DB error");
  });
});

describe("ensureDefaultEnvironment", () => {
  it("creates a default environment for an account that has none", async () => {
    // First read finds nothing; the re-read after the insert finds the row.
    h.state.queueByTable.set(environments, [[], [makeEnvironment()]]);

    const result = await ensureDefaultEnvironment(USER_ID);

    // One batch: the per-user lock, then the guarded insert.
    expect(h.state.batches).toHaveLength(1);
    expect(h.state.batches[0]).toHaveLength(2);
    expect(result.data).toEqual([makeEnvironment()]);
  });

  it("creates nothing when the user already has one", async () => {
    h.state.resultsByTable.set(environments, [makeEnvironment()]);

    const result = await ensureDefaultEnvironment(USER_ID);

    expect(h.state.inserted).toHaveLength(0);
    expect(result.data).toHaveLength(1);
  });
});

describe("updateEnvironment", () => {
  it("archives by stamping archived_at", async () => {
    const archived = makeEnvironment({ archived_at: "2026-09-01T00:00:00Z" });
    h.state.resultsByTable.set(environments, [archived]);

    const result = await updateEnvironment(USER_ID, ENV_ID, {
      archived_at: "2026-09-01T00:00:00Z",
    });

    expect(result.error).toBeNull();
    expect(result.data?.archived_at).toBe("2026-09-01T00:00:00Z");
  });

  it("returns an error when no owned row matches", async () => {
    h.state.resultsByTable.set(environments, []);

    const result = await updateEnvironment(USER_ID, "someone-elses", {
      name: "Nope",
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Environment not found");
  });
});

describe("createEnvironment", () => {
  it("inserts with the user's id", async () => {
    h.state.resultsByTable.set(environments, [
      makeEnvironment({ name: "New house" }),
    ]);

    const result = await createEnvironment(USER_ID, { name: "New house" });

    expect(h.state.inserted[0]).toMatchObject({
      user_id: USER_ID,
      name: "New house",
    });
    expect(result.data?.name).toBe("New house");
  });
});

describe("deleteEnvironment", () => {
  it("deletes when the user has more than one", async () => {
    h.state.resultsByTable.set(environments, [
      { id: ENV_ID },
      { id: "env-2" },
    ]);

    const result = await deleteEnvironment(USER_ID, ENV_ID);

    expect(result.error).toBeNull();
    expect(h.state.deleted).toBe(1);
  });

  it("refuses to delete the user's only environment", async () => {
    h.state.resultsByTable.set(environments, [{ id: ENV_ID }]);

    const result = await deleteEnvironment(USER_ID, ENV_ID);

    expect(result.error?.message).toMatch(/only environment/i);
    expect(h.state.deleted).toBe(0);
  });

  it("refuses an environment that is not the user's", async () => {
    h.state.resultsByTable.set(environments, [
      { id: ENV_ID },
      { id: "env-2" },
    ]);

    const result = await deleteEnvironment(USER_ID, "someone-elses");

    expect(result.error?.message).toBe("Environment not found");
    expect(h.state.deleted).toBe(0);
  });
});
