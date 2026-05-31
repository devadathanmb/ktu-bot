import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { getDb } from "./connection.js";
import type * as schema from "./schema/index.js";

type Database = NodePgDatabase<typeof schema>;

export type TransactionType = Parameters<
  Parameters<Database["transaction"]>[0]
>[0];

export async function withTransaction<T>(
  callback: (tx: TransactionType) => Promise<T>
): Promise<T> {
  return await getDb().transaction(callback);
}
