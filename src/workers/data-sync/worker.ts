import { Job } from "bullmq";
import {
  ResourceSyncer,
  AnnouncementsSyncer,
  CalendarsSyncer,
  ExamTimetablesSyncer,
} from "./syncers/index.js";
import {
  dataSyncQueue,
  setupRecurringSchedule,
  SyncJobData,
  SyncJobType,
} from "./queue.js";
import logger from "../../utils/logger.js";
import { BaseWorker } from "../base/base-worker.js";
import { DataSyncWorkerConfig } from "../../configs/data-sync-worker.js";

export class DataSyncWorker extends BaseWorker<SyncJobData> {
  private syncers!: Record<SyncJobType, ResourceSyncer>;

  constructor() {
    super("data-sync-worker", dataSyncQueue, {
      concurrency: 3,
      healthCheck: {
        maxFailedJobs: DataSyncWorkerConfig.MAX_FAILED_JOBS,
        maxBacklogJobs: DataSyncWorkerConfig.MAX_BACKLOG_JOBS,
        failedJobsLookbackMinutes:
          DataSyncWorkerConfig.FAILED_JOBS_WINDOW_MINUTES,
      },
    });
  }

  protected override initializeWorkerSpecific(): Promise<void> {
    // Initialize syncers for each data type
    this.syncers = {
      "data-sync:announcements": new AnnouncementsSyncer(this.db),
      "data-sync:academic-calendars": new CalendarsSyncer(this.db),
      "data-sync:exam-timetables": new ExamTimetablesSyncer(this.db),
    };

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

    return Promise.resolve();
  }

  protected override async onStartupComplete(): Promise<void> {
    // Perform initial sync if database is empty
    const syncTypesNeedingInitialSync = await this.checkNeedsInitialSync();
    if (syncTypesNeedingInitialSync.length > 0) {
      logger.info(
        { syncTypes: syncTypesNeedingInitialSync },
        "Initial sync required for one or more resources"
      );
      await this.scheduleInitialSyncJobs(syncTypesNeedingInitialSync);
    }

    // Set up recurring jobs (called once - BullMQ handles the schedule)
    await setupRecurringSchedule();
  }

  protected async processJob(job: Job<SyncJobData>): Promise<void> {
    const { syncType } = job.data;
    const syncer = this.syncers[syncType];

    if (!syncer) {
      throw new Error(`Unknown sync type: ${syncType}`);
    }

    // Check if this syncer needs initial sync
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

    const results = await Promise.allSettled(
      entries.map(async ([syncType, syncer]) => {
        const needs = await syncer.needsInitialSync();
        logger.info(
          { syncer: syncer.name, needsInitialSync: needs },
          "Checked initial sync need"
        );
        return needs ? syncType : null;
      })
    );

    return results
      .filter(
        (result): result is PromiseFulfilledResult<SyncJobType> =>
          result.status === "fulfilled" && result.value !== null
      )
      .map(result => result.value);
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
      return dataSyncQueue.add(syncType, { syncType });
    });

    if (jobs.length > 0) {
      await Promise.all(jobs);
      logger.info({ jobCount: jobs.length }, "Scheduled initial sync jobs");
    }
  }
}
