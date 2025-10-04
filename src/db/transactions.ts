import { db } from "./connection.js";

// Type for transaction instance
export type TransactionType = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

// Type for transaction callback
export type TransactionCallback<T> = (tx: TransactionType) => Promise<T>;

/**
 * Simple transaction wrapper - executes a callback within a transaction
 * Drizzle automatically rolls back the transaction if any error is thrown
 * Use this for any operations that need to write to the database
 */
export async function withTransaction<T>(
  callback: TransactionCallback<T>
): Promise<T> {
  return await db.transaction(callback);
}
