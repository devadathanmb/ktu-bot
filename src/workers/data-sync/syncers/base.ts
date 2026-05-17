import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "../../../db/schema/index.js";
import type { Got } from "got";

export interface ResourceSyncer {
  readonly name: string;

  needsInitialSync(): Promise<boolean>;

  performInitialSync(): Promise<void>;

  performPeriodicSync(): Promise<void>;
}

export abstract class BaseResourceSyncer implements ResourceSyncer {
  protected db: NodePgDatabase<typeof schema>;
  protected apiClient: Got;

  constructor(database: NodePgDatabase<typeof schema>, apiClient: Got) {
    this.db = database;
    this.apiClient = apiClient;
  }

  abstract readonly name: string;
  abstract needsInitialSync(): Promise<boolean>;
  abstract performInitialSync(): Promise<void>;
  abstract performPeriodicSync(): Promise<void>;
}
