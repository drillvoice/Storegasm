import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  fetchSpaceTree,
  createSpace,
  updateSpace,
  deleteSpace,
  fetchChildSpaces,
} from "@/lib/db/spaces";

/**
 * Builds a minimal mock Supabase client whose `.from()` chain can be
 * configured per-test by setting `mockResult`.
 */
function buildMockClient(mockResult: { data: unknown; error: unknown }) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(mockResult),
    single: vi.fn().mockResolvedValue(mockResult),
    // Awaiting the chain directly resolves to mockResult.
    then: (resolve: (v: unknown) => void) => resolve(mockResult),
  };
  return { from: vi.fn().mockReturnValue(chain), _chain: chain };
}

const USER_ID = "user-123";

describe("fetchSpaceTree", () => {
  it("returns an empty tree when the user has no spaces", async () => {
    const client = buildMockClient({ data: [], error: null });
    // Make the awaited chain return the mock result.
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null });

    const result = await fetchSpaceTree(client as never, USER_ID);

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

    const client = buildMockClient({ data: [parent, child], error: null });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [parent, child], error: null });

    const result = await fetchSpaceTree(client as never, USER_ID);

    expect(result.error).toBeNull();
    expect(result.data).toHaveLength(1);
    expect(result.data![0].id).toBe("parent-1");
    expect(result.data![0].children).toHaveLength(1);
    expect(result.data![0].children[0].id).toBe("child-1");
  });

  it("propagates database errors", async () => {
    const client = buildMockClient({ data: null, error: { message: "DB error" } });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: { message: "DB error" } });

    const result = await fetchSpaceTree(client as never, USER_ID);

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

    const client = buildMockClient({ data: newSpace, error: null });
    client._chain.single = vi.fn().mockResolvedValue({ data: newSpace, error: null });

    const result = await createSpace(client as never, USER_ID, { name: "Garage" });

    expect(client._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: USER_ID, name: "Garage" })
    );
    expect(result.data?.name).toBe("Garage");
  });
});

describe("updateSpace", () => {
  it("applies eq filters for both id and user_id", async () => {
    const updated = {
      id: "s-1",
      user_id: USER_ID,
      name: "Updated",
      description: null,
      parent_id: null,
      created_at: "",
      updated_at: "",
    };
    const client = buildMockClient({ data: updated, error: null });
    client._chain.single = vi.fn().mockResolvedValue({ data: updated, error: null });

    await updateSpace(client as never, USER_ID, "s-1", { name: "Updated" });

    expect(client._chain.eq).toHaveBeenCalledWith("id", "s-1");
    expect(client._chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

describe("deleteSpace", () => {
  it("returns null data on success", async () => {
    const client = buildMockClient({ data: null, error: null });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: null });

    const result = await deleteSpace(client as never, USER_ID, "s-1");

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });

  it("filters by user_id to prevent cross-user deletion", async () => {
    const client = buildMockClient({ data: null, error: null });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: null, error: null });

    await deleteSpace(client as never, USER_ID, "s-1");

    expect(client._chain.eq).toHaveBeenCalledWith("user_id", USER_ID);
  });
});

describe("fetchChildSpaces", () => {
  it("queries with is(parent_id, null) when parentId is null", async () => {
    const client = buildMockClient({ data: [], error: null });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null });

    await fetchChildSpaces(client as never, USER_ID, null);

    expect(client._chain.is).toHaveBeenCalledWith("parent_id", null);
  });

  it("queries with eq(parent_id, id) when parentId is set", async () => {
    const client = buildMockClient({ data: [], error: null });
    client._chain.then = (resolve: (v: unknown) => void) =>
      resolve({ data: [], error: null });

    await fetchChildSpaces(client as never, USER_ID, "parent-1");

    expect(client._chain.eq).toHaveBeenCalledWith("parent_id", "parent-1");
  });
});
