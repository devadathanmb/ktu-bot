import { Worker, Job, Queue } from "bullmq";
import { workerRedisConnectionOptions } from "../shared/redis.js";
import { closeDB, initDB } from "../../db/connection.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { RedisClient } from "bullmq";
import * as schema from "../../db/schema/index.js";
import { Bot } from "grammy";
import { BotContext } from "../../types/bot.types.js";
import logger from "../../utils/logger.js";

/**
 * Base worker class that provides common lifecycle management for all BullMQ workers.
 * Handles initialization, job processing, error handling, and graceful shutdown.
 */
export abstract class BaseWorker<TJobData = Record<string, unknown>> {
  protected worker: Worker | null = null;
  protected db!: NodePgDatabase<typeof schema>;
  protected redisClient!: RedisClient;
  protected bot?: Bot<BotContext>;

  constructor(
    protected readonly workerName: string,
    protected readonly queueName: string,
    protected readonly queue: Queue<TJobData>,
    protected readonly config?: {
      concurrency?: number;
      limiter?: { max: number; duration: number };
    }
  ) {}

  /**
   * Start the worker - initializes all resources and begins processing jobs
   */
  async start(): Promise<void> {
    if (this.worker) {
      logger.warn(`${this.workerName} already running`);
      return;
    }

    // Initialize Redis connection
    this.redisClient = await this.queue.client;
    await this.redisClient.ping();
    logger.info("Redis connection established");

    // Initialize database connection
    this.db = await initDB();
    logger.info("Database connection established");

    // Allow worker-specific initialization (e.g., bot setup)
    await this.initializeWorkerSpecific();

    // Create BullMQ worker instance
    this.worker = new Worker<TJobData>(
      this.queueName,
      this.processJobWrapper.bind(this),
      {
        connection: workerRedisConnectionOptions,
        concurrency: this.config?.concurrency ?? 1,
        ...(this.config?.limiter && { limiter: this.config.limiter }),
      }
    );

    // Setup event handlers
    this.worker.on("completed", this.onJobCompleted.bind(this));
    this.worker.on("failed", (job, error) => void this.onJobFailed(job, error));

    // Allow worker to perform post-startup tasks (e.g., schedule initial jobs)
    await this.onStartupComplete();

    logger.info(`${this.workerName} started`);
  }

  /**
   * Stop the worker - gracefully closes all resources
   */
  async stop(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    await this.queue.close();
    await closeDB();
    logger.info(`${this.workerName} stopped`);
  }

  /**
   * Check if worker is currently running
   */
  isRunning(): boolean {
    return this.worker !== null;
  }

  /**
   * Health check - returns whether worker is healthy
   * Checks: worker running AND Redis connected
   * Note: DB health is checked separately by setupHealthCheckEndpoint
   */
  async getStatus(): Promise<boolean> {
    const isRunning = this.isRunning();

    if (!isRunning) {
      return false;
    }

    try {
      const redisConnected = this.redisClient
        ? await this.redisClient
            .ping()
            .then(() => true)
            .catch(() => false)
        : false;

      // Worker is healthy if it's running AND Redis is connected
      return isRunning && redisConnected;
    } catch (error) {
      logger.warn({ error }, "Health check failed");
      return false;
    }
  }

  /**
   * Wrapper for job processing with error handling
   */
  private async processJobWrapper(job: Job<TJobData>): Promise<void> {
    await this.processJob(job);
  }

  /**
   * Default job completed handler
   */
  protected onJobCompleted(job: Job<TJobData>): void {
    const jobId = job.id;
    const data = job.data;
    const workerName = this.workerName;
    logger.info({ jobId, data, workerName }, "Job completed");
  }

  /**
   * Default job failed handler
   */
  protected async onJobFailed(
    job: Job<TJobData> | undefined,
    error: Error
  ): Promise<void> {
    const jobId = job?.id;
    const data = job?.data;
    const workerName = this.workerName;
    logger.error({ jobId, data, workerName, error }, "Job failed");

    if (job) {
      await job.log(
        `Job failed: ${error instanceof Error ? error.message : String(error)}`
      );
      if (error.stack) {
        await job.log(`Stack trace: ${error.stack}`);
      }
    }
  }

  // ==================== Abstract Methods (must be implemented by subclasses) ====================

  /**
   * Process a single job - core business logic
   */
  protected abstract processJob(job: Job<TJobData>): Promise<void>;

  // ==================== Optional Hooks (can be overridden by subclasses) ====================

  /**
   * Worker-specific initialization (e.g., bot setup, additional connections)
   * Override this to initialize bot or other worker-specific resources
   */
  protected async initializeWorkerSpecific(): Promise<void> {
    // Default: no-op, override in subclass if needed
  }

  /**
   * Called after worker is fully started (e.g., schedule initial jobs, setup recurring jobs)
   * Override this to perform post-startup tasks
   */
  protected async onStartupComplete(): Promise<void> {
    // Default: no-op, override in subclass if needed
  }
}
