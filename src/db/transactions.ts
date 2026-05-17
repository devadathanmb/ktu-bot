import { db } from "./connection.js";

export type TransactionType = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

/**
 * Simple transaction wrapper - executes a callback within a transaction
 * Drizzle automatically rolls back the transaction if any error is thrown
 * Use this for any operations that need to write to the database
 */
export async function withTransaction<T>(
  callback: (tx: TransactionType) => Promise<T>
): Promise<T> {
  return await db.transaction(callback);
}
