import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mocks the Drizzle db client with a thenable query chain. Results are keyed
 * by the schema table passed to from()/insert()/update()/delete(), so the
 * parallel queries in the modules under test each resolve their own data.
 */
const h = vi.hoisted(() => {
  const state = {
    resultsByTable: new Map<unknown, unknown[]>(),
    // Per-table queues, for the functions that query one table more than once
    // and need each call answered differently. Falls back to resultsByTable.
    queueByTable: new Map<unknown, unknown[][]>(),
    error: null as Error | null,
    inserted: [] as Record<string, unknown>[],
    updated: [] as Record<string, unknown>[],
    executed: [] as unknown[],
    executeResult: [] as unknown[],
  };

  function makeChain(initialTable?: unknown) {
    let table = initialTable;
    const chain: Record<string, unknown> = {};
    for (const m of [
      "select",
      "where",
      "orderBy",
      "limit",
      "leftJoin",
      "returning",
    ]) {
      chain[m] = () => chain;
    }
    chain.set = (v: Record<string, unknown>) => {
      state.updated.push(v);
      return chain;
    };
    chain.from = (t: unknown) => {
      table = t;
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
    delete: (t: unknown) => makeChain(t),
    // moveSpaceToEnvironment drops to raw SQL for its recursive CTE.
    execute: (q: unknown) => {
      state.executed.push(q);
      if (state.error) return Promise.reject(state.error);
      return Promise.resolve(state.executeResult);
    },
  };

  return { state, db };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ db: h.db }));

import {
  fetchSpaceTree,
  createSpace,
  updateSpace,
  deleteSpace,
  fetchChildSpaces,
  moveSpaceToEnvironment,
} from "@/lib/db/spaces";
import { spaces } from "@/lib/db/schema";

const USER_ID = "user-123";
const ENV_ID = "env-1";
const OTHER_ENV_ID = "env-2";

function makeSpace(overrides: Record<string, unknown> = {}) {
  return {
    id: "s-1",
    user_id: USER_ID,
    environment_id: ENV_ID,
    name: "Bedroom",
    description: null,
    parent_id: null,
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
  h.state.executed = [];
  h.state.executeResult = [];
});

describe("fetchSpaceTree", () => {
  it("returns an empty tree when the user has no spaces", async () => {
    h.state.resultsByTable.set(spaces, []);

    const result = await fetchSpaceTree(USER_ID, ENV_ID);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("nests child spaces under their parent", async () => {
    const parent = makeSpace({ id: "parent-1", name: "Bedroom" });
    const child = makeSpace({
      id: "child-1",
      name: "Under bed",
      parent_id: "parent-1",
    });
    h.state.resultsByTable.set(spaces, [parent, child]);

    const result = await fetchSpaceTree(USER_ID, ENV_ID);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].id).toBe("parent-1");
    expect(result.data![0].children).toHaveLength(1);
    expect(result.data![0].children[0].id).toBe("child-1");
  });

  it("propagates database errors", async () => {
    h.state.error = new Error("DB error");

    const result = await fetchSpaceTree(USER_ID, ENV_ID);

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("DB error");
  });
});

describe("createSpace", () => {
  it("inserts with the correct user_id and environment_id", async () => {
    h.state.resultsByTable.set(spaces, [makeSpace({ id: "new-1", name: "Garage" })]);

    const result = await createSpace(USER_ID, ENV_ID, { name: "Garage" });

    expect(h.state.inserted[0]).toMatchObject({
      user_id: USER_ID,
      environment_id: ENV_ID,
      name: "Garage",
    });
    expect(result.data?.name).toBe("Garage");
  });

  it("refuses a parent in a different environment", async () => {
    // parentIsInEnvironment filters on environment_id, so no row comes back.
    h.state.resultsByTable.set(spaces, []);

    const result = await createSpace(USER_ID, ENV_ID, {
      name: "Shelf",
      parent_id: "elsewhere",
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe(
      "Parent space is in a different environment"
    );
    expect(h.state.inserted).toHaveLength(0);
  });
});

describe("updateSpace", () => {
  it("returns the updated space on success", async () => {
    h.state.resultsByTable.set(spaces, [makeSpace({ name: "Updated" })]);

    const result = await updateSpace(USER_ID, "s-1", { name: "Updated" });

    expect(result.error).toBeNull();
    expect(result.data?.name).toBe("Updated");
  });

  it("returns an error when no owned row matches", async () => {
    h.state.resultsByTable.set(spaces, []);

    const result = await updateSpace(USER_ID, "someone-elses", {
      name: "Nope",
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Space not found");
  });

  it("refuses to re-parent a space into another environment", async () => {
    // First query resolves the space, second is the environment-filtered
    // parent lookup, which finds nothing because the parent is elsewhere.
    h.state.queueByTable.set(spaces, [[makeSpace()], []]);

    const result = await updateSpace(USER_ID, "s-1", {
      parent_id: "parent-in-other-env",
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe(
      "Parent space is in a different environment"
    );
    expect(h.state.updated).toHaveLength(0);
  });

  it("allows re-parenting within the same environment", async () => {
    h.state.queueByTable.set(spaces, [
      [makeSpace()],
      [makeSpace({ id: "parent-1" })],
      [makeSpace({ parent_id: "parent-1" })],
    ]);

    const result = await updateSpace(USER_ID, "s-1", { parent_id: "parent-1" });

    expect(result.error).toBeNull();
    expect(result.data?.parent_id).toBe("parent-1");
  });
});

describe("moveSpaceToEnvironment", () => {
  it("moves the subtree to the top level of another environment", async () => {
    h.state.queueByTable.set(spaces, [[makeSpace()]]);

    const result = await moveSpaceToEnvironment(
      USER_ID,
      "s-1",
      OTHER_ENV_ID,
      null
    );

    expect(result.error).toBeNull();
    // One recursive statement carries the spaces and their items across.
    expect(h.state.executed).toHaveLength(1);
  });

  it("refuses a destination that is not in the target environment", async () => {
    h.state.queueByTable.set(spaces, [
      [makeSpace()],
      // The destination exists but still lives in the source environment.
      [makeSpace({ id: "dest-1", environment_id: ENV_ID })],
    ]);

    const result = await moveSpaceToEnvironment(
      USER_ID,
      "s-1",
      OTHER_ENV_ID,
      "dest-1"
    );

    expect(result.error?.message).toBe(
      "Destination space is not in that environment"
    );
    expect(h.state.executed).toHaveLength(0);
  });

  it("refuses to move a space into its own contents", async () => {
    h.state.queueByTable.set(spaces, [
      [makeSpace()],
      [makeSpace({ id: "dest-1", environment_id: OTHER_ENV_ID })],
    ]);
    // The recursive subtree lookup finds the destination inside the subtree.
    h.state.executeResult = [{ id: "dest-1" }];

    const result = await moveSpaceToEnvironment(
      USER_ID,
      "s-1",
      OTHER_ENV_ID,
      "dest-1"
    );

    expect(result.error?.message).toBe(
      "A space cannot be moved into its own contents"
    );
    // Only the subtree probe ran — no move statement.
    expect(h.state.executed).toHaveLength(1);
  });

  it("returns an error when the space is not the user's", async () => {
    h.state.queueByTable.set(spaces, [[]]);

    const result = await moveSpaceToEnvironment(
      USER_ID,
      "not-mine",
      OTHER_ENV_ID,
      null
    );

    expect(result.error?.message).toBe("Space not found");
    expect(h.state.executed).toHaveLength(0);
  });
});

describe("deleteSpace", () => {
  it("returns null data on success", async () => {
    const result = await deleteSpace(USER_ID, "s-1");

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it("propagates database errors", async () => {
    h.state.error = new Error("delete failed");

    const result = await deleteSpace(USER_ID, "s-1");

    expect(result.error?.message).toBe("delete failed");
  });
});

describe("fetchChildSpaces", () => {
  it("returns children for a parent id", async () => {
    const child = makeSpace({ id: "c-1", name: "Shelf", parent_id: "parent-1" });
    h.state.resultsByTable.set(spaces, [child]);

    const result = await fetchChildSpaces(USER_ID, ENV_ID, "parent-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual([child]);
  });

  it("returns root spaces when parentId is null", async () => {
    h.state.resultsByTable.set(spaces, []);

    const result = await fetchChildSpaces(USER_ID, ENV_ID, null);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});
