/**
 * Turning driver failures into messages a person can act on.
 *
 * Drizzle wraps every failed statement in a DrizzleQueryError whose message is
 * the SQL it tried to run ("Failed query: insert into … params: …"); the reason
 * the database rejected it is on `.cause`. Reporting only the wrapper puts a
 * wall of SQL in front of the user and says nothing about the cause — which is
 * how a database still missing the environments migration looked like a bug in
 * the New environment form.
 *
 * So: unwrap to the innermost cause, and translate the two SQLSTATEs that mean
 * "the database is behind the code" into the instruction that actually fixes
 * them.
 */

/** Postgres SQLSTATEs raised when a table or column the code expects is absent. */
const UNDEFINED_TABLE = "42P01";
const UNDEFINED_COLUMN = "42703";

const SCHEMA_BEHIND_HINT =
  "The database is missing tables or columns this version of the app needs — " +
  "its migrations have not been applied. Run `npm run db:migrate` against it " +
  "(see SETUP.md, step 4).";

/** Errors carry the SQLSTATE on `code`, but it is not part of the Error type. */
function errorCode(e: unknown): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const code = (e as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

/**
 * Walks to the innermost `cause`, which is where the driver puts the message
 * the database actually sent back.
 */
function rootCause(e: unknown): unknown {
  let current = e;
  const seen = new Set<unknown>();
  while (
    current instanceof Error &&
    current.cause !== undefined &&
    current.cause !== null &&
    !seen.has(current.cause)
  ) {
    seen.add(current.cause);
    current = current.cause;
  }
  return current;
}

/**
 * Describes why a query failed, in one sentence.
 *
 * @param e - Anything thrown by a Drizzle query.
 * @returns The database's own message, prefixed with what to do about it when
 *   the failure means the schema is out of date.
 */
export function describeDbError(e: unknown): string {
  const cause = rootCause(e);
  const message =
    cause instanceof Error
      ? cause.message
      : typeof cause === "string"
        ? cause
        : String((cause as { message?: unknown })?.message ?? cause);

  const code = errorCode(cause) ?? errorCode(e);
  if (code === UNDEFINED_TABLE || code === UNDEFINED_COLUMN) {
    return `${SCHEMA_BEHIND_HINT} (${message})`;
  }
  // Some drivers report it in prose rather than by SQLSTATE.
  if (/relation ".+" does not exist|column ".+" does not exist/i.test(message)) {
    return `${SCHEMA_BEHIND_HINT} (${message})`;
  }
  return message;
}

/**
 * Wraps a thrown query error in the `{ data, error }` shape the data layer
 * returns everywhere.
 *
 * @param e - Anything thrown by a Drizzle query.
 * @returns An error result carrying a human-readable message.
 */
export function toDbError(e: unknown): {
  data: null;
  error: { message: string };
} {
  return { data: null, error: { message: describeDbError(e) } };
}
