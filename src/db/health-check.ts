import logger from "../utils/logger.js";
import { getDb, getPoolStats } from "./connection.js";

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await getDb().execute("SELECT NOW()");
    return true;
  } catch (error) {
    // Pool stats distinguish a saturated pool (waitingCount > 0) from an
    // unreachable server; pg-pool reports both as the same timeout message.
    logger.error(
      { err: error, pool: getPoolStats() },
      "Database health check failed"
    );
    return false;
  }
}
