import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mocks the Drizzle db client with a thenable query chain. Results are keyed
 * by the schema table passed to from()/insert()/update()/delete(), so the
 * parallel item + space queries in searchItems each resolve their own data.
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
    selectCount: 0,
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
    select: () => {
      state.selectCount++;
      return makeChain();
    },
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
  fetchItemsBySpace,
  fetchUnassignedItems,
  createItem,
  updateItem,
  deleteItem,
  searchItems,
} from "@/lib/db/items";
import { environments, items, spaces } from "@/lib/db/schema";

const USER_ID = "user-123";
const SPACE_ID = "space-1";
const ENV_ID = "env-1";
const OTHER_ENV_ID = "env-2";

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: "item-1",
    user_id: USER_ID,
    environment_id: ENV_ID,
    space_id: SPACE_ID,
    name: "Winter coats",
    description: null,
    tags: [],
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
  h.state.selectCount = 0;
});

describe("fetchItemsBySpace", () => {
  it("returns items for the space", async () => {
    const item = makeItem();
    h.state.resultsByTable.set(items, [item]);

    const result = await fetchItemsBySpace(USER_ID, ENV_ID, SPACE_ID);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([item]);
  });

  it("returns empty array when no items exist", async () => {
    const result = await fetchItemsBySpace(USER_ID, ENV_ID, SPACE_ID);
    expect(result.data).toEqual([]);
  });
});

describe("fetchUnassignedItems", () => {
  it("returns empty array when nothing is unassigned", async () => {
    const result = await fetchUnassignedItems(USER_ID, ENV_ID);
    expect(result.data).toEqual([]);
  });
});

describe("searchItems", () => {
  it("returns empty results for blank query without calling the DB", async () => {
    const result = await searchItems(USER_ID, ENV_ID, "   ");

    expect(result.data).toEqual([]);
    expect(h.state.selectCount).toBe(0);
  });

  it("builds the full breadcrumb path from the ancestor chain", async () => {
    h.state.resultsByTable.set(items, [
      makeItem({
        space_id: "tub-1",
        tags: ["clothes"],
        space: { id: "tub-1", name: "Tub 1" },
      }),
    ]);
    h.state.resultsByTable.set(spaces, [
      { id: "bedroom", name: "Bedroom", parent_id: null },
      { id: "under-bed", name: "Under bed", parent_id: "bedroom" },
      { id: "tub-1", name: "Tub 1", parent_id: "under-bed" },
    ]);
    h.state.resultsByTable.set(environments, [
      { id: ENV_ID, name: "My Home" },
    ]);

    const result = await searchItems(USER_ID, ENV_ID, "coats");

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].space).toEqual({ id: "tub-1", name: "Tub 1" });
    expect(result.data![0].space_path).toBe("Bedroom › Under bed › Tub 1");
    expect(result.data![0].environment).toEqual({
      id: ENV_ID,
      name: "My Home",
    });
    // The join column must not leak into the flat item fields.
    expect(result.data![0]).not.toHaveProperty("search_vector");
  });

  it("stops walking the breadcrumb if the parent chain loops", async () => {
    h.state.resultsByTable.set(items, [
      makeItem({ space_id: "a", space: { id: "a", name: "A" } }),
    ]);
    h.state.resultsByTable.set(spaces, [
      { id: "a", name: "A", parent_id: "b" },
      { id: "b", name: "B", parent_id: "a" },
    ]);

    const result = await searchItems(USER_ID, ENV_ID, "coats");

    expect(result.error).toBeNull();
    expect(result.data![0].space_path).toBe("B › A");
  });

  it("labels each result with its environment when searching all of them", async () => {
    h.state.resultsByTable.set(items, [
      makeItem({ id: "item-1", space_id: null, space: null }),
      makeItem({
        id: "item-2",
        environment_id: OTHER_ENV_ID,
        space_id: null,
        space: null,
      }),
    ]);
    h.state.resultsByTable.set(spaces, []);
    h.state.resultsByTable.set(environments, [
      { id: ENV_ID, name: "My Home" },
      { id: OTHER_ENV_ID, name: "New house" },
    ]);

    const result = await searchItems(USER_ID, null, "coats");

    expect(result.data!.map((r) => r.environment?.name)).toEqual([
      "My Home",
      "New house",
    ]);
  });

  it("returns null space and path for unassigned items", async () => {
    h.state.resultsByTable.set(items, [
      makeItem({ id: "item-2", name: "Loose cable", space_id: null, space: null }),
    ]);
    h.state.resultsByTable.set(spaces, []);

    const result = await searchItems(USER_ID, ENV_ID, "cable");

    expect(result.data![0].space).toBeNull();
    expect(result.data![0].space_path).toBeNull();
  });

  it("propagates errors", async () => {
    h.state.error = new Error("search failed");

    const result = await searchItems(USER_ID, ENV_ID, "coats");

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("search failed");
  });
});

describe("createItem", () => {
  it("takes its environment from the space it is filed in, not the caller's", async () => {
    // The space lives in another environment — moving an item into a space in
    // the new house has to move the item there too.
    h.state.resultsByTable.set(spaces, [{ environment_id: OTHER_ENV_ID }]);
    h.state.resultsByTable.set(items, [
      makeItem({ environment_id: OTHER_ENV_ID }),
    ]);

    const result = await createItem(USER_ID, ENV_ID, {
      name: "Winter coats",
      space_id: SPACE_ID,
    });

    expect(h.state.inserted[0]).toMatchObject({
      user_id: USER_ID,
      environment_id: OTHER_ENV_ID,
      tags: [],
    });
    expect(result.data?.name).toBe("Winter coats");
  });

  it("files an unassigned item in the active environment", async () => {
    h.state.resultsByTable.set(items, [makeItem({ space_id: null })]);

    await createItem(USER_ID, ENV_ID, { name: "Loose cable" });

    expect(h.state.inserted[0]).toMatchObject({ environment_id: ENV_ID });
  });

  it("returns an error when the space is not the user's", async () => {
    h.state.resultsByTable.set(spaces, []);

    const result = await createItem(USER_ID, ENV_ID, {
      name: "Winter coats",
      space_id: "someone-elses",
    });

    expect(result.error?.message).toBe("Space not found");
    expect(h.state.inserted).toHaveLength(0);
  });
});

describe("updateItem", () => {
  it("returns the updated item on success", async () => {
    h.state.resultsByTable.set(items, [makeItem({ name: "New name" })]);

    const result = await updateItem(USER_ID, "item-1", { name: "New name" });

    expect(result.data?.name).toBe("New name");
  });

  it("re-derives the environment when the item moves to another space", async () => {
    h.state.resultsByTable.set(spaces, [{ environment_id: OTHER_ENV_ID }]);
    h.state.resultsByTable.set(items, [
      makeItem({ environment_id: OTHER_ENV_ID, space_id: "space-in-new-house" }),
    ]);

    const result = await updateItem(USER_ID, "item-1", {
      space_id: "space-in-new-house",
    });

    expect(result.error).toBeNull();
    expect(h.state.updated[0]).toMatchObject({
      space_id: "space-in-new-house",
      environment_id: OTHER_ENV_ID,
    });
  });

  it("leaves the environment alone when an item is unassigned", async () => {
    h.state.resultsByTable.set(items, [makeItem({ space_id: null })]);

    await updateItem(USER_ID, "item-1", { space_id: null });

    expect(h.state.updated[0]).not.toHaveProperty("environment_id");
  });

  it("returns an error when no owned row matches", async () => {
    h.state.resultsByTable.set(items, []);

    const result = await updateItem(USER_ID, "missing", { name: "Nope" });

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("Item not found");
  });
});

describe("deleteItem", () => {
  it("returns null data on success", async () => {
    const result = await deleteItem(USER_ID, "item-1");

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});
