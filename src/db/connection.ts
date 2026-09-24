import { drizzle } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";
import { DbConfig } from "../configs/db.js";
import logger from "../utils/logger.js";

let db: NodePgDatabase<typeof schema> | undefined;
let pool: Pool | undefined;

export interface InitDbOptions {
  /**
   * Max pooled connections for this process. Pools are per-process and
   * multiply across the app + worker containers against a single server
   * connection limit, so keep each one small.
   */
  max?: number;
  /** Reported as `application_name` in pg_stat_activity for attribution. */
  applicationName?: string;
}

export interface PoolStats {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
}

export async function initDB(
  options: InitDbOptions = {}
): Promise<NodePgDatabase<typeof schema>> {
  // The Aiven plan caps the database at 20 connections, and every process
  // (app + workers) owns an independent pool, so keep each pool small enough
  // that a burst across processes cannot exhaust the server's slots.
  // idleTimeoutMillis must exceed the slowest health-check interval (60s) so
  // probes reuse connections instead of opening (and tearing down) a new one,
  // which is what previously produced intermittent connect timeouts.
  // connectionTimeoutMillis makes an unreachable server fail fast instead of
  // waiting on the kernel SYN-retry window (~127s) while /health hangs.
  const dbPool = new Pool({
    connectionString: DbConfig.DATABASE_URI,
    ssl: DbConfig.SSL_CONFIG,
    max: options.max ?? 2,
    idleTimeoutMillis: 120_000,
    connectionTimeoutMillis: 5_000,
    keepAlive: true,
    keepAliveInitialDelayMillis: 10_000,
    ...(options.applicationName
      ? { application_name: options.applicationName }
      : {}),
  });

  dbPool.on("error", error => {
    logger.error(
      {
        err: error,
        totalCount: dbPool.totalCount,
        idleCount: dbPool.idleCount,
        waitingCount: dbPool.waitingCount,
      },
      "Idle database client error"
    );
  });

  pool = dbPool;
  db = drizzle({ client: dbPool, schema, logger: false });

  const now = await db.execute("SELECT NOW()");
  logger.info(
    { now: String(now.rows[0]!.now) },
    "Database connection established"
  );

  return db;
}

export async function closeDB(): Promise<void> {
  if (!pool) return;

  await pool.end();
  pool = undefined;
  db = undefined;
  logger.info("Database connection closed");
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!db) {
    throw new Error("Database has not been initialized. Call initDB() first.");
  }
  return db;
}

export function getPoolStats(): PoolStats | undefined {
  if (!pool) return undefined;

  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}
