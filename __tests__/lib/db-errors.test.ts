import { describe, it, expect } from "vitest";
import { describeDbError, toDbError } from "@/lib/db/errors";

/**
 * The shape Drizzle throws: the message is the SQL it tried to run, and the
 * reason the database rejected it hangs off `cause`.
 */
function drizzleError(cause: Error) {
  return new Error(
    'Failed query: insert into "environments" ("id", "user_id", "name") ' +
      "values (default, $1, $2)\nparams: user-123,1 Harding Street",
    { cause }
  );
}

function pgError(message: string, code: string) {
  return Object.assign(new Error(message), { code });
}

describe("describeDbError", () => {
  it("returns the message of a plain error unchanged", () => {
    expect(describeDbError(new Error("DB error"))).toBe("DB error");
  });

  it("unwraps the driver error hiding behind Drizzle's SQL dump", () => {
    const message = describeDbError(
      drizzleError(new Error("duplicate key value violates unique constraint"))
    );

    expect(message).toBe("duplicate key value violates unique constraint");
    expect(message).not.toMatch(/Failed query/);
  });

  it("unwraps a chain of causes to the innermost one", () => {
    const inner = new Error("connection terminated");
    const middle = new Error("query failed", { cause: inner });

    expect(describeDbError(drizzleError(middle))).toBe("connection terminated");
  });

  it("explains an unapplied migration when a table is missing", () => {
    const message = describeDbError(
      drizzleError(
        pgError('relation "environments" does not exist', "42P01")
      )
    );

    expect(message).toMatch(/migrations have not been applied/i);
    expect(message).toMatch(/npm run db:migrate/);
    expect(message).toMatch(/relation "environments" does not exist/);
  });

  it("explains an unapplied migration when a column is missing", () => {
    const message = describeDbError(
      drizzleError(
        pgError('column "environment_id" does not exist', "42703")
      )
    );

    expect(message).toMatch(/migrations have not been applied/i);
  });

  it("recognises the missing-relation wording without a SQLSTATE", () => {
    const message = describeDbError(
      drizzleError(new Error('relation "environments" does not exist'))
    );

    expect(message).toMatch(/migrations have not been applied/i);
  });

  it("survives a non-Error being thrown", () => {
    expect(describeDbError("something broke")).toBe("something broke");
  });
});

describe("toDbError", () => {
  it("wraps the description in the data-layer result shape", () => {
    expect(toDbError(drizzleError(new Error("nope")))).toEqual({
      data: null,
      error: { message: "nope" },
    });
  });
});
