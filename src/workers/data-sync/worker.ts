import { Worker, Job } from "bullmq";
import { redisConnection } from "../shared/redis.js";
import { closeDB, initDB } from "../../db/connection.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { RedisClient } from "bullmq";
import * as schema from "../../db/schema/index.js";
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

export class DataSyncWorker {
  private worker: Worker | null = null;
  private db!: NodePgDatabase<typeof schema>;
  private redisClient!: RedisClient;
  private syncers!: Map<string, ResourceSyncer>;

  constructor() {}

  async start() {
    if (this.worker) {
      logger.warn("Worker already running");
      return;
    }

    // Initialize Redis
    this.redisClient = await dataSyncQueue.client;
    await this.redisClient.ping();
    logger.info("Redis connection established");

    // Initialize database
    this.db = await initDB();
    logger.info("Database connection established");

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

    // Perform initial sync if database is empty
    const needsInitialSync = await this.checkNeedsInitialSync();
    if (needsInitialSync) {
      logger.info("Initial sync required for one or more resources");
      await this.scheduleInitialSyncJobs();
    }

    // Start BullMQ worker to process sync jobs
    this.worker = new Worker<SyncJobData>(
      DATA_SYNC_QUEUE,
      this.processJobWrapper.bind(this),
      {
        connection: redisConnection,
        concurrency: 3, // Can process up to 3 jobs simultaneously
        limiter: {
          max: 10,
          duration: 1000,
        },
      }
    );

    this.worker.on("completed", this.onJobCompleted.bind(this));
    this.worker.on("failed", this.onJobFailed.bind(this));

    // Set up recurring jobs (called once - BullMQ handles the schedule)
    await setupRecurringSchedule();

    logger.info("Data sync worker started");
  }

  async stop() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    await dataSyncQueue.close();
    await closeDB();
    logger.info("Data sync worker stopped");
  }

  private async processJobWrapper(job: Job<SyncJobData>) {
    try {
      await this.processJob(job);
    } catch (error) {
      logger.error(
        { jobId: job.id, syncType: job.data.syncType, error },
        "Sync job failed in wrapper"
      );
      throw error;
    }
  }

  private async processJob(job: Job<SyncJobData>) {
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

  private onJobCompleted(job: Job<SyncJobData>) {
    logger.info(
      { jobId: job.id, syncType: job.data.syncType },
      "Sync job completed"
    );
  }

  private onJobFailed(job: Job<SyncJobData> | undefined, error: Error) {
    logger.error(
      { jobId: job?.id, syncType: job?.data.syncType, error },
      "Sync job failed"
    );
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
    const isRunning = this.worker !== null;
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
