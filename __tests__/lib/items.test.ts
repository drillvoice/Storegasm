import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Mocks the Drizzle db client with a thenable query chain. Results are keyed
 * by the schema table passed to from()/insert()/update()/delete(), so the
 * parallel item + space queries in searchItems each resolve their own data.
 */
const h = vi.hoisted(() => {
  const state = {
    resultsByTable: new Map<unknown, unknown[]>(),
    error: null as Error | null,
    inserted: [] as Record<string, unknown>[],
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
    select: () => {
      state.selectCount++;
      return makeChain();
    },
    insert: (t: unknown) => makeChain(t),
    update: (t: unknown) => makeChain(t),
    delete: (t: unknown) => makeChain(t),
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
import { items, spaces } from "@/lib/db/schema";

const USER_ID = "user-123";
const SPACE_ID = "space-1";

beforeEach(() => {
  h.state.resultsByTable = new Map();
  h.state.error = null;
  h.state.inserted = [];
  h.state.selectCount = 0;
});

describe("fetchItemsBySpace", () => {
  it("returns items for the space", async () => {
    const item = {
      id: "item-1",
      user_id: USER_ID,
      space_id: SPACE_ID,
      name: "Winter coats",
      description: null,
      tags: [],
      created_at: "",
      updated_at: "",
    };
    h.state.resultsByTable.set(items, [item]);

    const result = await fetchItemsBySpace(USER_ID, SPACE_ID);

    expect(result.error).toBeNull();
    expect(result.data).toEqual([item]);
  });

  it("returns empty array when no items exist", async () => {
    const result = await fetchItemsBySpace(USER_ID, SPACE_ID);
    expect(result.data).toEqual([]);
  });
});

describe("fetchUnassignedItems", () => {
  it("returns empty array when nothing is unassigned", async () => {
    const result = await fetchUnassignedItems(USER_ID);
    expect(result.data).toEqual([]);
  });
});

describe("searchItems", () => {
  it("returns empty results for blank query without calling the DB", async () => {
    const result = await searchItems(USER_ID, "   ");

    expect(result.data).toEqual([]);
    expect(h.state.selectCount).toBe(0);
  });

  it("builds the full breadcrumb path from the ancestor chain", async () => {
    h.state.resultsByTable.set(items, [
      {
        id: "item-1",
        user_id: USER_ID,
        space_id: "tub-1",
        name: "Winter coats",
        description: null,
        tags: ["clothes"],
        created_at: "",
        updated_at: "",
        space: { id: "tub-1", name: "Tub 1" },
      },
    ]);
    h.state.resultsByTable.set(spaces, [
      { id: "bedroom", name: "Bedroom", parent_id: null },
      { id: "under-bed", name: "Under bed", parent_id: "bedroom" },
      { id: "tub-1", name: "Tub 1", parent_id: "under-bed" },
    ]);

    const result = await searchItems(USER_ID, "coats");

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].space).toEqual({ id: "tub-1", name: "Tub 1" });
    expect(result.data![0].space_path).toBe("Bedroom › Under bed › Tub 1");
    // The join column must not leak into the flat item fields.
    expect(result.data![0]).not.toHaveProperty("search_vector");
  });

  it("returns null space and path for unassigned items", async () => {
    h.state.resultsByTable.set(items, [
      {
        id: "item-2",
        user_id: USER_ID,
        space_id: null,
        name: "Loose cable",
        description: null,
        tags: [],
        created_at: "",
        updated_at: "",
        space: null,
      },
    ]);
    h.state.resultsByTable.set(spaces, []);

    const result = await searchItems(USER_ID, "cable");

    expect(result.data![0].space).toBeNull();
    expect(result.data![0].space_path).toBeNull();
  });

  it("propagates errors", async () => {
    h.state.error = new Error("search failed");

    const result = await searchItems(USER_ID, "coats");

    expect(result.data).toBeNull();
    expect(result.error?.message).toBe("search failed");
  });
});

describe("createItem", () => {
  it("inserts with user_id and default empty tags", async () => {
    const newItem = {
      id: "item-1",
      user_id: USER_ID,
      space_id: SPACE_ID,
      name: "Winter coats",
      description: null,
      tags: [],
      created_at: "",
      updated_at: "",
    };
    h.state.resultsByTable.set(items, [newItem]);

    const result = await createItem(USER_ID, {
      name: "Winter coats",
      space_id: SPACE_ID,
    });

    expect(h.state.inserted[0]).toMatchObject({ user_id: USER_ID, tags: [] });
    expect(result.data?.name).toBe("Winter coats");
  });
});

describe("updateItem", () => {
  it("returns the updated item on success", async () => {
    const updated = {
      id: "item-1",
      user_id: USER_ID,
      space_id: null,
      name: "New name",
      description: null,
      tags: [],
      created_at: "",
      updated_at: "",
    };
    h.state.resultsByTable.set(items, [updated]);

    const result = await updateItem(USER_ID, "item-1", { name: "New name" });

    expect(result.data?.name).toBe("New name");
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
