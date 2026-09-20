import type { Job } from "bullmq";
import type { ResourceSyncer } from "./syncers/base.js";
import type { SyncJobData, SyncJobType } from "./queue.js";
import logger from "../../utils/logger.js";

export interface InitialSyncJob {
  name: SyncJobType;
  data: SyncJobData;
}

export interface DataSyncProcessorDeps {
  syncers: Record<SyncJobType, ResourceSyncer>;
  enqueueSyncJob: (job: InitialSyncJob) => Promise<unknown>;
}

export class DataSyncProcessor {
  private readonly syncers: Record<SyncJobType, ResourceSyncer>;
  private readonly enqueueSyncJob: (job: InitialSyncJob) => Promise<unknown>;

  constructor(deps: DataSyncProcessorDeps) {
    this.syncers = deps.syncers;
    this.enqueueSyncJob = deps.enqueueSyncJob;

    const syncerNames = Object.values(this.syncers)
      .map(s => s.name)
      .join(", ");
    logger.info(
      {
        syncerCount: Object.keys(this.syncers).length,
        syncers: syncerNames,
      },
      "Initialized syncers"
    );
  }

  async scheduleInitialSync(): Promise<void> {
    const syncTypesNeedingInitialSync = await this.checkNeedsInitialSync();
    if (syncTypesNeedingInitialSync.length > 0) {
      logger.info(
        { syncTypes: syncTypesNeedingInitialSync },
        "Initial sync required for one or more resources"
      );
      await this.scheduleInitialSyncJobs(syncTypesNeedingInitialSync);
    }
  }

  async process(job: Job<SyncJobData>): Promise<void> {
    const { syncType } = job.data;
    const syncer = this.syncers[syncType];

    if (!syncer) {
      throw new Error(`Unknown sync type: ${syncType}`);
    }

    const needsInitial = await syncer.needsInitialSync();

    if (needsInitial) {
      logger.info(
        { syncer: syncer.name, jobId: job.id },
        "Performing initial sync"
      );
      await syncer.performInitialSync();
      logger.info(
        { syncer: syncer.name, jobId: job.id },
        "Initial sync completed"
      );
    } else {
      logger.info(
        { syncer: syncer.name, jobId: job.id },
        "Starting periodic sync"
      );
      await syncer.performPeriodicSync();
      logger.info(
        { syncer: syncer.name, jobId: job.id },
        "Periodic sync completed"
      );
    }
  }

  private async checkNeedsInitialSync(): Promise<SyncJobType[]> {
    const entries = Object.entries(this.syncers) as [
      SyncJobType,
      ResourceSyncer,
    ][];

    // A rejected check must fail startup visibly instead of being mistaken
    // for a resource that needs no initial sync.
    const needs = await Promise.all(
      entries.map(async ([syncType, syncer]) => {
        const needsSync = await syncer.needsInitialSync();
        logger.info(
          { syncer: syncer.name, needsInitialSync: needsSync },
          "Checked initial sync need"
        );
        return needsSync ? syncType : null;
      })
    );

    return needs.filter(
      (syncType): syncType is SyncJobType => syncType !== null
    );
  }

  private async scheduleInitialSyncJobs(
    syncTypes: SyncJobType[]
  ): Promise<void> {
    logger.info("Scheduling initial sync jobs for needed resources");

    const jobs = syncTypes.map(syncType => {
      const syncer = this.syncers[syncType];
      logger.info(
        { syncer: syncer.name },
        "Needs initial sync, scheduling job"
      );
      return this.enqueueSyncJob({ name: syncType, data: { syncType } });
    });

    if (jobs.length > 0) {
      await Promise.all(jobs);
      logger.info({ jobCount: jobs.length }, "Scheduled initial sync jobs");
    }
  }
}
