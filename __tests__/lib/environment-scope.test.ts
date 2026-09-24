import { describe, it, expect } from "vitest";
import { resolveEnvironment } from "@/lib/environment-scope";
import type { Environment } from "@/lib/types";

function env(id: string, archived = false): Environment {
  return {
    id,
    user_id: "u",
    name: id,
    description: null,
    archived_at: archived ? "2026-01-01T00:00:00Z" : null,
    created_at: "",
    updated_at: "",
  };
}

describe("resolveEnvironment", () => {
  it("uses the selection while it is active", () => {
    expect(resolveEnvironment([env("a"), env("b")], "b")?.id).toBe("b");
  });

  it("falls back to the first active one when the selection was archived", () => {
    expect(resolveEnvironment([env("a"), env("b", true)], "b")?.id).toBe("a");
  });

  it("falls back to the first active one when the selection is gone", () => {
    expect(resolveEnvironment([env("a")], "deleted")?.id).toBe("a");
  });

  it("uses an archived environment only when nothing is active", () => {
    expect(resolveEnvironment([env("a", true), env("b", true)], "b")?.id).toBe("b");
    expect(resolveEnvironment([env("a", true)], null)?.id).toBe("a");
  });

  it("returns null when there are none", () => {
    expect(resolveEnvironment([], "a")).toBeNull();
  });
});
