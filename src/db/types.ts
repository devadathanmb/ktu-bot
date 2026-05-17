import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { TransactionType } from "./transactions.js";
import type * as schema from "./schema/index.js";

export type DatabaseInstance = NodePgDatabase<typeof schema> | TransactionType;
