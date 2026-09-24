import { describe, it, expect } from "vitest";
import {
  createItemInput,
  createSpaceInput,
  moveSpaceInput,
  parseInput,
  updateEnvironmentInput,
  updateItemInput,
  updateSpaceInput,
} from "@/lib/validation";

const UUID = "3f2b8c1e-4a5d-4e6f-9a7b-1c2d3e4f5a6b";

describe("parseInput", () => {
  it("passes through a payload the UI would send", () => {
    const result = parseInput(updateItemInput, {
      name: "Drill",
      description: null,
      space_id: UUID,
      tags: ["tools"],
    });

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      name: "Drill",
      description: null,
      space_id: UUID,
      tags: ["tools"],
    });
  });

  it("rejects ownership and scope columns smuggled into an update", () => {
    // Drizzle's .set() writes any key that names a column, so these must
    // never get past the action boundary.
    expect(parseInput(updateItemInput, { user_id: "someone" }).error).not.toBeNull();
    expect(
      parseInput(updateSpaceInput, { environment_id: UUID }).error
    ).not.toBeNull();
    expect(
      parseInput(updateEnvironmentInput, { user_id: "someone" }).error
    ).not.toBeNull();
  });

  it("rejects an id that is not a UUID", () => {
    const result = parseInput(createSpaceInput, {
      name: "Shed",
      parent_id: "not-a-uuid",
    });

    expect(result.data).toBeNull();
    expect(result.error?.message).toMatch(/parent_id/);
  });

  it("enforces the same length limits as the database", () => {
    expect(parseInput(createItemInput, { name: "" }).error).not.toBeNull();
    expect(
      parseInput(createItemInput, { name: "x".repeat(201) }).error
    ).not.toBeNull();
    expect(
      parseInput(createItemInput, { name: "ok", description: "x".repeat(2001) })
        .error
    ).not.toBeNull();
  });

  it("accepts archiving and restoring an environment", () => {
    expect(
      parseInput(updateEnvironmentInput, {
        archived_at: new Date().toISOString(),
      }).error
    ).toBeNull();
    expect(
      parseInput(updateEnvironmentInput, { archived_at: null }).error
    ).toBeNull();
  });

  it("requires both fields of a move", () => {
    expect(
      parseInput(moveSpaceInput, { environment_id: UUID, parent_id: null }).error
    ).toBeNull();
    expect(parseInput(moveSpaceInput, { environment_id: UUID }).error).not.toBeNull();
  });
});
