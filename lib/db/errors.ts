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

/** SQLSTATE for a foreign key violation. */
const FOREIGN_KEY_VIOLATION = "23503";

/**
 * What each foreign key in lib/db/schema.ts means when a write breaks it.
 *
 * The composite keys are the environment rules themselves — the data layer
 * relies on them instead of checking first — so a violation is an ordinary
 * refusal ("that parent is in another environment") and deserves a sentence,
 * not the constraint name.
 */
const FOREIGN_KEY_MESSAGES: Record<string, string> = {
  spaces_environment_owner_fk: "Environment not found",
  items_environment_owner_fk: "Environment not found",
  spaces_parent_same_environment_fk:
    "Parent space is not in that environment",
  items_space_same_environment_fk: "Space is not in that environment",
  items_space_id_spaces_id_fk: "Space not found",
};

const SCHEMA_BEHIND_HINT =
  "The database is missing tables or columns this version of the app needs — " +
  "its migrations have not been applied. Run `npm run db:migrate` against it " +
  "(see SETUP.md, step 4).";

/**
 * Reads a string field the driver adds to its errors (`code` for the SQLSTATE,
 * `constraint` for the violated constraint) that isn't part of the Error type.
 */
function errorField(e: unknown, field: "code" | "constraint"): string | undefined {
  if (typeof e !== "object" || e === null) return undefined;
  const value = (e as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
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

  const code = errorField(cause, "code") ?? errorField(e, "code");
  if (code === FOREIGN_KEY_VIOLATION) {
    const constraint = errorField(cause, "constraint") ?? "";
    const known = FOREIGN_KEY_MESSAGES[constraint];
    if (known) return known;
  }
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
