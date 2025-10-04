import logger from "../utils/logger.js";
import { db } from "./connection.js";

export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await db.execute("SELECT NOW()");
    return true;
  } catch (error) {
    logger.error(error, "Database health check failed");
    return false;
  }
}
