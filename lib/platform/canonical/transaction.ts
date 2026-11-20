import type { Pool, PoolClient } from "pg";

/** Reuse canonical writers inside an enclosing service transaction. The writer's
 * COMMIT releases its savepoint; it never commits the outer workflow event early. */
export function canonicalWritePool(client: PoolClient): Pool {
  return { query: client.query.bind(client), connect: async () => ({ release() {}, query: (sql: string, values?: unknown[]) =>
    client.query(sql === "BEGIN" ? "SAVEPOINT canonical_information"
      : sql === "COMMIT" ? "RELEASE SAVEPOINT canonical_information"
        : sql === "ROLLBACK" ? "ROLLBACK TO SAVEPOINT canonical_information" : sql, values),
  }) } as unknown as Pool;
}
