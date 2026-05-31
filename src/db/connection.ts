import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";
import { DbConfig } from "../configs/db.js";
import logger from "../utils/logger.js";

let db: NodePgDatabase<typeof schema> | undefined;
let pool: Pool | undefined;

export async function initDB(): Promise<NodePgDatabase<typeof schema>> {
  pool = new Pool({
    connectionString: DbConfig.DATABASE_URI,
    ssl: DbConfig.SSL_CONFIG,
  });

  db = drizzle({ client: pool, schema, logger: false });

  const now = await db.execute("SELECT NOW()");
  logger.info(
    { now: String(now.rows[0]!.now) },
    "Database connection established"
  );

  return db;
}

export async function closeDB(): Promise<void> {
  try {
    if (pool) {
      await pool.end();
      pool = undefined;
      db = undefined;
      logger.info("Database connection closed");
    }
  } catch (error) {
    logger.error(error, "Failed to close database connection");
  }
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    throw new Error("Database has not been initialized. Call initDB() first.");
  }
  return db;
}
