import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mocks the Drizzle db client with a thenable query chain. Results are keyed
 * by the schema table passed to from()/insert()/update()/delete(), so the
 * parallel queries in the modules under test each resolve their own data.
 */
const h = vi.hoisted(() => {
  const state = {
    resultsByTable: new Map<unknown, unknown[]>(),
    error: null as Error | null,
    inserted: [] as Record<string, unknown>[],
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
      "set",
      "returning",
    ]) {
      chain[m] = () => chain;
    }
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
      return resolve(state.resultsByTable.get(table) ?? []);
    };
    return chain;
  }

  const db = {
    select: () => makeChain(),
    insert: (t: unknown) => makeChain(t),
    update: (t: unknown) => makeChain(t),
    delete: (t: unknown) => makeChain(t),
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
} from "@/lib/db/spaces";
import { spaces } from "@/lib/db/schema";

const USER_ID = "user-123";

beforeEach(() => {
  h.state.resultsByTable = new Map();
  h.state.error = null;
  h.state.inserted = [];
});

describe("fetchSpaceTree", () => {
  it("returns an empty tree when the user has no spaces", async () => {
    h.state.resultsByTable.set(spaces, []);

    const result = await fetchSpaceTree(USER_ID);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });

  it("nests child spaces under their parent", async () => {
    const parent = {
      id: "parent-1",
      user_id: USER_ID,
      name: "Bedroom",
      description: null,
      parent_id: null,
      created_at: "",
      updated_at: "",
    };
    const child = {
      id: "child-1",
      user_id: USER_ID,
      name: "Under bed",
      description: null,
      parent_id: "parent-1",
      created_at: "",
      updated_at: "",
    };
    h.state.resultsByTable.set(spaces, [parent, child]);

    const result = await fetchSpaceTree(USER_ID);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].id).toBe("parent-1");
    expect(result.data![0].children).toHaveLength(1);
    expect(result.data![0].children[0].id).toBe("child-1");
  });

  it("propagates database errors", async () => {
    h.state.error = new Error("DB error");

    const result = await fetchSpaceTree(USER_ID);

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("DB error");
  });
});

describe("createSpace", () => {
  it("inserts with the correct user_id", async () => {
    const newSpace = {
      id: "new-1",
      user_id: USER_ID,
      name: "Garage",
      description: null,
      parent_id: null,
      created_at: "",
      updated_at: "",
    };
    h.state.resultsByTable.set(spaces, [newSpace]);

    const result = await createSpace(USER_ID, { name: "Garage" });

    expect(h.state.inserted[0]).toMatchObject({
      user_id: USER_ID,
      name: "Garage",
    });
    expect(result.data?.name).toBe("Garage");
  });
});

describe("updateSpace", () => {
  it("returns the updated space on success", async () => {
    const updated = {
      id: "s-1",
      user_id: USER_ID,
      name: "Updated",
      description: null,
      parent_id: null,
      created_at: "",
      updated_at: "",
    };
    h.state.resultsByTable.set(spaces, [updated]);

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
    const child = {
      id: "c-1",
      user_id: USER_ID,
      name: "Shelf",
      description: null,
      parent_id: "parent-1",
      created_at: "",
      updated_at: "",
    };
    h.state.resultsByTable.set(spaces, [child]);

    const result = await fetchChildSpaces(USER_ID, "parent-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual([child]);
  });

  it("returns root spaces when parentId is null", async () => {
    h.state.resultsByTable.set(spaces, []);

    const result = await fetchChildSpaces(USER_ID, null);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([]);
  });
});
