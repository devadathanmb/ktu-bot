import { Worker, Job } from "bullmq";
import { redisConnection } from "../shared/redis.js";
import { closeDB, initDB } from "../../db/connection.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { RedisClient } from "bullmq";
import * as schema from "../../db/schema/index.js";
import { createBot } from "../../bot/bot.js";
import { AnnouncementSubscriptionRepository } from "../../db/repositories/AnnouncementSubscriptionRepository.js";
import { ChatRepository } from "../../db/repositories/ChatRepository.js";
import { Bot, GrammyError, InputMediaBuilder } from "grammy";
import { BotContext } from "../../types/bot.types.js";
import { BroadcastJob, ProcessedAttachment } from "../shared/types.js";
import { Queue } from "bullmq";
import { FormattedString } from "@grammyjs/parse-mode";
import logger from "../../utils/logger.js";
import { checkQueueHealth } from "../shared/queueHealth.js";
import { BroadcastsWorkerConfig } from "../../configs/broadcastsWorker.js";

export const BROADCASTS_QUEUE = "BROADCASTS_QUEUE";

export const broadcastsQueue = new Queue<BroadcastJob>(BROADCASTS_QUEUE, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: "exponential",
      delay: 10 * 1000, // 10 seconds
    },
    removeOnComplete: {
      count: 100, // Keep last 100 completed jobs
      age: 24 * 60 * 60, // Keep for 24 hours
    },
    removeOnFail: {
      count: 50, // Keep last 50 failed jobs for debugging
    },
  },
});

// Bulk add broadcast jobs
export async function addBroadcastJobs(jobsData: BroadcastJob[]) {
  const jobs = jobsData.map(jobData => ({
    name: "broadcast:send",
    data: jobData,
  }));

  const results = await broadcastsQueue.addBulk(jobs);
  logger.debug({ jobCount: results.length }, "Added broadcast jobs in bulk");
  return results;
}

// Add a single broadcast job
export async function addBroadcastJob(jobData: BroadcastJob) {
  const job = await broadcastsQueue.add("broadcast:send", jobData);
  logger.debug({ jobId: job.id }, "Added single broadcast job");
  return job;
}

export class BroadcastsWorker {
  private worker: Worker | null = null;
  private bot!: Bot<BotContext>;
  private db!: NodePgDatabase<typeof schema>;
  private redisClient!: RedisClient;

  constructor() {
    // Properties initialized in start()
  }

  async start() {
    if (this.worker) {
      logger.warn("Worker is already running");
      return;
    }

    // Initialize Redis
    this.redisClient = await broadcastsQueue.client;
    await this.redisClient.ping();
    logger.info("Redis connection established");

    // Initialize database
    this.db = await initDB();
    logger.info("Database initialized");

    // Initialize bot
    this.bot = createBot();
    logger.info("Bot instance created");

    // Start worker
    this.worker = new Worker<BroadcastJob>(
      BROADCASTS_QUEUE,
      this.processJobWrapper.bind(this),
      {
        connection: redisConnection,
        concurrency: 1,
      }
    );

    this.worker.on("completed", this.onJobCompleted.bind(this));
    this.worker.on("failed", this.onJobFailed.bind(this));

    logger.info("Worker started");
  }

  async stop() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    await broadcastsQueue.close();
    await closeDB();
    logger.info("Worker stopped");
  }

  private onJobCompleted(job: Job<BroadcastJob>) {
    logger.info(
      { jobId: job.id, chatId: job.data.chatId },
      "Broadcast job completed"
    );
  }

  private onJobFailed(job: Job<BroadcastJob> | undefined, err: Error) {
    logger.error(
      { jobId: job?.id, chatId: job?.data.chatId, error: err },
      "Broadcast job failed"
    );
  }

  /**
   * Wrapper method that handles common error scenarios
   */
  private async processJobWrapper(job: Job<BroadcastJob>) {
    try {
      await this.processJob(job);
    } catch (error) {
      if (error instanceof GrammyError) {
        const chatId = job.data.chatId;
        const errorCode = error.error_code;
        const errorDescription = error.description;

        // Telegram sends 403 for forbidden errors like bot being blocked by user
        // It sends 400 with description "Bad Request: USER_IS_BLOCKED" in some cases too
        const isUserBlockedError =
          errorCode === 403 ||
          (errorCode == 400 && errorDescription.includes("USER_IS_BLOCKED"));

        if (isUserBlockedError) {
          // User blocked the bot
          logger.warn(
            { chatId, error: errorDescription },
            "User blocked the bot, updating status"
          );
          await this.handleBlockedUser(chatId);
        } else if (errorCode === 429) {
          // Rate limited - pause the entire queue
          const retryAfter = error.parameters?.retry_after || 30;
          const duration = retryAfter * 1000 + 1000; // Add 1 second buffer

          logger.warn(
            { chatId, retryAfter, duration },
            "Rate limited by Telegram, pausing entire queue"
          );

          await this.handleRateLimit(duration);

          // Re-throw to retry this job later
          throw error;
        } else {
          // Handle other Telegram errors
          await this.handleTelegramError(error, chatId);
        }
      } else {
        // Handle non-Telegram errors
        await this.handleGenericError(error as Error, job);
      }
    }
  }

  private async processJob(job: Job<BroadcastJob>) {
    // Get job data from the job
    const { formattedText, attachments, chatId } = job.data;

    // By the time the job has reached broadcasts worker, the user may have blocked the bot
    // Hence, we should verify if the subscription still exists before sending
    // Otherwise we are just wasting API calls and risking rate limits
    const subscriptionRepo = new AnnouncementSubscriptionRepository(this.db);
    const subscriptionExists = await subscriptionRepo.exists(chatId);
    if (!subscriptionExists) return;

    // If there are no attachments, send text message only
    if (!attachments || attachments.length === 0) {
      await this.sendMessage(chatId, formattedText);
      return;
    }

    // If there are attachments, batch them into groups of 10 and send as media groups
    const batchSize = 10;
    const batches: ProcessedAttachment[][] = [];

    for (let i = 0; i < attachments.length; i += batchSize) {
      batches.push(attachments.slice(i, i + batchSize));
    }

    // Send first batch with the formatted text as caption
    if (batches.length > 0) {
      const message = await this.sendMessageWithAttachmentsAsMediaGroup(
        chatId,
        formattedText,
        batches[0]!
      );

      // Send remaining batches without caption
      // messages[0] will represent the first message in the media group so we can reply to it
      for (let i = 1; i < batches.length; i++) {
        await this.sendAttachmentsAsMediaGroup(
          chatId,
          batches[i]!,
          message[0]!.message_id
        );
      }
    }
  }

  /**
   * Send a formatted text message
   */
  private async sendMessage(chatId: number, formattedText: FormattedString) {
    return await this.bot.api.sendMessage(chatId, formattedText.rawText, {
      entities: formattedText.rawEntities,
      link_preview_options: { is_disabled: true },
    });
  }

  /**
   * Send message with attachments as a media group in a single API call
   * First attachment includes the caption (formatted text)
   * Subsequent attachments have no caption
   * Note: Telegram limits media groups to 10 items max
   */
  private async sendMessageWithAttachmentsAsMediaGroup(
    chatId: number,
    formattedText: FormattedString,
    attachments: ProcessedAttachment[]
  ) {
    const documents = attachments.map((attachment, index) => {
      const params = {};

      if (index === 0) {
        Object.assign(params, {
          caption: formattedText.rawText,
          caption_entities: formattedText.rawEntities,
        });
      }

      // One of fileId or fileUrl will be present
      return InputMediaBuilder.document(
        attachment.fileId! || attachment.fileUrl!,
        params
      );
    });

    return await this.bot.api.sendMediaGroup(chatId, documents);
  }

  /**
   * Send attachments as a media group without caption
   * Used for subsequent batches when there are more than 10 attachments
   */
  private async sendAttachmentsAsMediaGroup(
    chatId: number,
    attachments: ProcessedAttachment[],
    messageIdToReplyTo?: number
  ) {
    const params = {};

    if (messageIdToReplyTo) {
      Object.assign(params, {
        reply_parameters: {
          message_id: messageIdToReplyTo,
          allow_sending_without_reply: true,
        },
      });
    }

    const documents = attachments.map(attachment => {
      // One of fileId or fileUrl will be present
      return InputMediaBuilder.document(
        attachment.fileId! || attachment.fileUrl!
      );
    });

    return await this.bot.api.sendMediaGroup(chatId, documents, params);
  }

  /**
   * Handle user who blocked the bot
   */
  private async handleBlockedUser(chatId: number) {
    await this.db.transaction(async tx => {
      const subscriptionRepo = new AnnouncementSubscriptionRepository(tx);
      const chatRepo = new ChatRepository(tx);

      // Remove the user's subscription
      await subscriptionRepo.delete(chatId);

      // Create a chat record if not exists
      // There can be cases where user has already blocked the bot but somehow the chat record doesn't exist
      await chatRepo.createIfNotExists(chatId);

      // Mark the user as blocked
      await chatRepo.markKicked(chatId);
    });
  }

  /**
   * Handle rate limiting by pausing the queue and resuming after duration
   */
  private async handleRateLimit(duration: number): Promise<void> {
    logger.info({ pauseDuration: duration }, "Pausing queue due to rate limit");

    // Pause the entire queue
    await broadcastsQueue.pause();

    // Resume after the specified duration
    setTimeout(async () => {
      try {
        await broadcastsQueue.resume();
        logger.info("Queue resumed after rate limit pause");
      } catch (error) {
        logger.error({ error }, "Failed to resume queue after rate limit");
      }
    }, duration);
  }

  private async handleTelegramError(
    error: GrammyError,
    chatId: number
  ): Promise<void> {
    logger.error(
      { chatId, errorCode: error.error_code, error: error.description },
      "Unhandled Telegram error"
    );
  }

  private async handleGenericError(
    error: Error,
    job: Job<BroadcastJob>
  ): Promise<void> {
    logger.error(
      { jobId: job.id, error },
      "Unhandled generic error in job processing"
    );
  }

  async getStatus() {
    const isRunning = this.worker !== null;

    if (!isRunning) {
      return { isRunning: false, redisConnected: false, queueHealth: false };
    }

    try {
      const redisConnected = this.redisClient
        ? await this.redisClient
            .ping()
            .then(() => true)
            .catch(() => false)
        : false;
      const queueHealth = await checkQueueHealth(broadcastsQueue, {
        maxFailedJobs: BroadcastsWorkerConfig.HEALTHCHECK.MAX_FAILED_JOBS,
        maxBacklogJobs: BroadcastsWorkerConfig.HEALTHCHECK.MAX_BACKLOG_JOBS,
      });

      return {
        isRunning: true,
        redisConnected,
        queueHealth,
      };
    } catch (error) {
      logger.warn({ error }, "Health check failed");
      return { isRunning: true, redisConnected: false, queueHealth: false };
    }
  }
}
