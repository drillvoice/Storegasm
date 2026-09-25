import { describe, it, expect, vi, afterEach } from "vitest";
import { api } from "@/lib/api/client";

function respond(status: number, body: unknown) {
  return vi.fn<(url: string) => Promise<Response>>(async () =>
    typeof body === "string"
      ? new Response(body, { status })
      : Response.json(body, { status })
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("api", () => {
  it("resolves to the data and builds the route's URL", async () => {
    const fetch = respond(200, { data: [{ id: "i1" }], error: null });
    vi.stubGlobal("fetch", fetch);

    await expect(api.items("env 1", "space/1")).resolves.toEqual([{ id: "i1" }]);
    expect(fetch.mock.calls[0][0]).toBe(
      "/api/environments/env%201/items?space=space%2F1"
    );
  });

  it("asks for unassigned items when there is no space", async () => {
    const fetch = respond(200, { data: [], error: null });
    vi.stubGlobal("fetch", fetch);

    await api.items("env-1", null);

    expect(fetch.mock.calls[0][0]).toBe("/api/environments/env-1/items");
  });

  it("omits the environment to search everywhere", async () => {
    const fetch = respond(200, { data: [], error: null });
    vi.stubGlobal("fetch", fetch);

    await api.search(null, "winter coat");

    expect(fetch.mock.calls[0][0]).toBe("/api/search?q=winter%20coat");
  });

  it("throws the server's message", async () => {
    vi.stubGlobal(
      "fetch",
      respond(401, { data: null, error: { message: "Not authenticated" } })
    );

    await expect(api.environments()).rejects.toThrow("Not authenticated");
  });

  it("throws with the status when the body isn't JSON", async () => {
    vi.stubGlobal("fetch", respond(502, "<html>Bad gateway</html>"));

    await expect(api.tags("env-1")).rejects.toThrow("Request failed (502)");
  });
});
