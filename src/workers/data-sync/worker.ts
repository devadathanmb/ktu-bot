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
  DATA_SYNC_QUEUE,
} from "./queue.js";
import logger from "../../utils/logger.js";
import { checkQueueHealth } from "../shared/queueHealth.js";
import { DataSyncWorkerConfig } from "../../configs/dataSyncWorker.js";
import { BaseWorker } from "../base/BaseWorker.js";

export class DataSyncWorker extends BaseWorker<SyncJobData> {
  private syncers!: Map<string, ResourceSyncer>;

  constructor() {
    super("data-sync-worker", DATA_SYNC_QUEUE, dataSyncQueue, {
      concurrency: 3,
      limiter: { max: 10, duration: 1000 },
    });
  }

  protected override initializeWorkerSpecific(): Promise<void> {
    // Initialize syncers for each data type
    this.syncers = new Map<string, ResourceSyncer>([
      ["data-sync:announcements", new AnnouncementsSyncer(this.db)],
      ["data-sync:academic-calendars", new CalendarsSyncer(this.db)],
      ["data-sync:exam-timetables", new ExamTimetablesSyncer(this.db)],
    ]);

    logger.info(
      `Initialized ${this.syncers.size} syncers: ${Array.from(
        this.syncers.values()
      )
        .map(s => s.name)
        .join(", ")}`
    );

    return Promise.resolve();
  }

  protected override async onStartupComplete(): Promise<void> {
    // Perform initial sync if database is empty
    const needsInitialSync = await this.checkNeedsInitialSync();
    if (needsInitialSync) {
      logger.info("Initial sync required for one or more resources");
      await this.scheduleInitialSyncJobs();
    }

    // Set up recurring jobs (called once - BullMQ handles the schedule)
    await setupRecurringSchedule();
  }

  protected async processJob(job: Job<SyncJobData>): Promise<void> {
    const { syncType } = job.data;
    const syncer = this.syncers.get(syncType);

    if (!syncer) {
      throw new Error(`Unknown sync type: ${syncType}`);
    }

    // Check if this syncer needs initial sync
    const needsInitial = await syncer.needsInitialSync();

    if (needsInitial) {
      logger.info(`[${syncer.name}] Performing initial sync via job ${job.id}`);
      await syncer.performInitialSync();
      logger.info(`[${syncer.name}] Initial sync completed via job ${job.id}`);
    } else {
      logger.info(`[${syncer.name}] Starting periodic sync via job ${job.id}`);
      await syncer.performPeriodicSync();
      logger.info(`[${syncer.name}] Completed periodic sync via job ${job.id}`);
    }
  }

  private async checkNeedsInitialSync(): Promise<boolean> {
    logger.debug("Checking if any resource needs initial sync");

    const results = await Promise.allSettled(
      Array.from(this.syncers.values()).map(async syncer => {
        const needs = await syncer.needsInitialSync();
        logger.debug(`[${syncer.name}] needsInitialSync: ${needs}`);
        return needs;
      })
    );

    return results.some(
      result => result.status === "fulfilled" && result.value === true
    );
  }

  private async scheduleInitialSyncJobs(): Promise<void> {
    logger.info("Scheduling initial sync jobs for needed resources");

    const timestamp = Date.now();
    const jobs = [];

    for (const [syncType, syncer] of this.syncers.entries()) {
      const needs = await syncer.needsInitialSync();
      if (needs) {
        logger.info(`[${syncer.name}] Needs initial sync, scheduling job`);
        jobs.push(
          dataSyncQueue.add(syncType as SyncJobType, {
            syncType: syncType as SyncJobType,
            scheduledAt: timestamp,
          })
        );
      }
    }

    if (jobs.length > 0) {
      await Promise.all(jobs);
      logger.info(`Scheduled ${jobs.length} initial sync job(s)`);
    }
  }

  async getStatus() {
    const isRunning = this.isRunning();
    const queueHealth = await checkQueueHealth(dataSyncQueue, {
      maxFailedJobs: DataSyncWorkerConfig.HEALTHCHECK.MAX_FAILED_JOBS,
      maxBacklogJobs: DataSyncWorkerConfig.HEALTHCHECK.MAX_BACKLOG_JOBS,
    });

    return {
      isRunning,
      queueHealth,
    };
  }
}
