import { describe, it, expect, vi, beforeEach } from "vitest";

const h = vi.hoisted(() => ({ userId: "user-1" as string | null }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/session", () => ({
  getSessionUserId: async () => h.userId,
}));

import { invalid, readRoute } from "@/lib/api/read-route";

beforeEach(() => {
  h.userId = "user-1";
});

describe("readRoute", () => {
  it("loads for the session user and answers with the result", async () => {
    const load = vi.fn(async (userId: string) => ({
      data: [userId],
      error: null,
    }));

    const response = await readRoute(load);

    expect(load).toHaveBeenCalledWith("user-1");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(await response.json()).toEqual({ data: ["user-1"], error: null });
  });

  it("answers 401 without loading when there is no session", async () => {
    h.userId = null;
    const load = vi.fn();

    const response = await readRoute(load);

    expect(load).not.toHaveBeenCalled();
    expect(response.status).toBe(401);
    expect((await response.json()).error.message).toBe("Not authenticated");
  });

  it("answers 400 for invalid parameters", async () => {
    const response = await readRoute(async () =>
      invalid({ message: "Invalid input — Invalid id" })
    );

    expect(response.status).toBe(400);
    expect((await response.json()).error.message).toBe(
      "Invalid input — Invalid id"
    );
  });

  it("answers 500 with the data layer's message when a query fails", async () => {
    const response = await readRoute(async () => ({
      data: null,
      error: { message: "The database is missing tables" },
    }));

    expect(response.status).toBe(500);
    expect((await response.json()).error.message).toBe(
      "The database is missing tables"
    );
  });
});
