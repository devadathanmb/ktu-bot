import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../db/schema/index.js";

/**
 * Base interface for all resource syncers
 * Each syncer is responsible for syncing one type of resource (announcements, calendars, etc.)
 */
export interface ResourceSyncer {
  /**
   * Name of the resource being synced (for logging purposes)
   */
  readonly name: string;

  /**
   * Check if initial sync is needed for this resource
   * Should return true if the resource has never been synced or needs full refresh
   */
  needsInitialSync(): Promise<boolean>;

  /**
   * Perform initial full sync of all historical data
   * This is called once when the worker starts if needsInitialSync() returns true
   */
  performInitialSync(): Promise<void>;

  /**
   * Perform incremental periodic sync
   * This is called by scheduled BullMQ jobs to fetch and sync recent data
   */
  performPeriodicSync(): Promise<void>;
}

/**
 * Abstract base class for resource syncers
 * Provides common functionality and enforces the interface
 */
export abstract class BaseResourceSyncer implements ResourceSyncer {
  protected db: NodePgDatabase<typeof schema>;

  constructor(database: NodePgDatabase<typeof schema>) {
    this.db = database;
  }

  abstract readonly name: string;
  abstract needsInitialSync(): Promise<boolean>;
  abstract performInitialSync(): Promise<void>;
  abstract performPeriodicSync(): Promise<void>;
}
