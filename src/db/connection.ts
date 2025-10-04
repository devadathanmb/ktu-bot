import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";
import { DbConfig } from "../configs/db.js";
import logger from "../utils/logger.js";

// Database instance
let db: NodePgDatabase<typeof schema>;
let pool: Pool;

export async function initDB(): Promise<NodePgDatabase<typeof schema>> {
  try {
    // Create pool with SSL config if present
    pool = new Pool({
      connectionString: DbConfig.DATABASE_URI,
      ssl: DbConfig.SSL_CONFIG,
    });

    // Create drizzle db instance
    db = drizzle({ client: pool, schema, logger: false });

    // Test the connection
    const now = await db.execute("SELECT NOW()");
    logger.info(`⚡ NOW: ${String(now.rows[0]!.now)}`);

    logger.info("🗃️ Database connection established successfully");

    return db;
  } catch (error) {
    logger.error(error, "Failed to initialize database connection");
    throw error;
  }
}

export async function closeDB(): Promise<void> {
  try {
    if (pool) {
      await pool.end();
      logger.info("Database connection closed");
    }
  } catch (error) {
    logger.error(error, "Failed to close database connection");
  }
}

// Export the database instance and functions
export { db };
