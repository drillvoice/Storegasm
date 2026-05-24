import { describe, it, expect, vi } from "vitest";
import {
  fetchItemsBySpace,
  fetchUnassignedItems,
  createItem,
  updateItem,
  deleteItem,
  searchItems,
} from "@/lib/db/items";

const USER_ID = "user-123";
const SPACE_ID = "space-1";

function buildMockClient(mockResult: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    textSearch: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(mockResult),
    then: (resolve: (v: unknown) => void) => resolve(mockResult),
  };
  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

describe("fetchItemsBySpace", () => {
  it("filters by space_id and user_id", async () => {
    const client = buildMockClient({ data: [], error: null });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null });

    await fetchItemsBySpace(client as never, USER_ID, SPACE_ID);

    expect(client._chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
    expect(client._chain.eq).toHaveBeenCalledWith("space_id", SPACE_ID);
  });

  it("returns empty array when no items exist", async () => {
    const client = buildMockClient({ data: null, error: null });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: null });

    const result = await fetchItemsBySpace(client as never, USER_ID, SPACE_ID);
    expect(result.data).toEqual([]);
  });
});

describe("fetchUnassignedItems", () => {
  it("queries with is(space_id, null)", async () => {
    const client = buildMockClient({ data: [], error: null });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null });

    await fetchUnassignedItems(client as never, USER_ID);

    expect(client._chain.is).toHaveBeenCalledWith("space_id", null);
  });
});

describe("searchItems", () => {
  it("returns empty results for blank query without calling the DB", async () => {
    const client = buildMockClient({ data: [], error: null });

    const result = await searchItems(client as never, USER_ID, "   ");

    expect(result.data).toEqual([]);
    expect(client.from).not.toHaveBeenCalled();
  });

  it("calls textSearch on the search_vector column", async () => {
    const client = buildMockClient({ data: [], error: null });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null });

    await searchItems(client as never, USER_ID, "winter coats");

    expect(client._chain.textSearch).toHaveBeenCalledWith(
      "search_vector",
      "winter coats",
      expect.objectContaining({ config: "english" })
    );
  });

  it("propagates errors", async () => {
    const client = buildMockClient({ data: null, error: { message: "search failed" } });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: { message: "search failed" } });

    const result = await searchItems(client as never, USER_ID, "coats");

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
    const client = buildMockClient({ data: newItem, error: null });
    client._chain.single = vi.fn().mockResolvedValue({ data: newItem, error: null });

    const result = await createItem(client as never, USER_ID, {
      name: "Winter coats",
      space_id: SPACE_ID,
    });

    expect(client._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, tags: [] })
    );
    expect(result.data?.name).toBe("Winter coats");
  });
});

describe("deleteItem", () => {
  it("filters by both item id and user_id", async () => {
    const client = buildMockClient({ data: null, error: null });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: null });

    await deleteItem(client as never, USER_ID, "item-1");

    expect(client._chain.eq).toHaveBeenCalledWith("id", "item-1");
    expect(client._chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
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
    const client = buildMockClient({ data: updated, error: null });
    client._chain.single = vi.fn().mockResolvedValue({ data: updated, error: null });

    const result = await updateItem(client as never, USER_ID, "item-1", {
      name: "New name",
    });

    expect(result.data?.name).toBe("New name");
  });
});
