import { db } from "./connection.js";

export type TransactionType = Parameters<
  Parameters<typeof db.transaction>[0]
>[0];

export async function withTransaction<T>(
  callback: (tx: TransactionType) => Promise<T>
): Promise<T> {
  return await db.transaction(callback);
}
