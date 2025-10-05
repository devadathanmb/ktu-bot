import { Worker, Job } from "bullmq";
import { workerRedisConnectionOptions } from "../../shared/redis.js";
import { fetchAnnouncements, LLMService } from "../../../api/services/index.js";
import { AnnouncementsBufferRepository } from "../../../db/repositories/AnnouncementsBufferRepository.js";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/AnnouncementSubscriptionRepository.js";
import { closeDB, initDB } from "../../../db/connection.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { RedisClient } from "bullmq";
import * as schema from "../../../db/schema/index.js";
import { Announcement } from "../../../types/service.types.js";
import findCourseFiltersFromText from "../../../utils/findCourseFiltersFromText.js";
import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcementsNotifyWorker.js";
import { BaseNotifier } from "../../base/notify/BaseNotifier.js";
import { addBroadcastJobs, broadcastsQueue } from "../../broadcasts/worker.js";
import { fmt, b } from "@grammyjs/parse-mode";
import { FormattedString } from "@grammyjs/parse-mode";
import {
  combineFormattedDouble,
  combineFormattedSingle,
} from "../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { BroadcastJob } from "../../shared/types.js";
import { AnnouncementFilter } from "../../../constants/courses.js";
import {
  announcementsNotifyQueue,
  setupRecurringSchedule,
  NotifyJobData,
  ANNOUNCEMENTS_NOTIFY_QUEUE,
} from "./queue.js";
import logger from "../../../utils/logger.js";
import { withTransaction } from "../../../db/transactions.js";
import { checkQueueHealth } from "../../shared/queueHealth.js";

export class AnnouncementsNotifyWorker extends BaseNotifier<
  NotifyJobData,
  Announcement
> {
  private worker: Worker | null = null;
  private db!: NodePgDatabase<typeof schema>;
  private redisClient!: RedisClient;
  private fetchedAnnouncements: Announcement[] = [];

  constructor() {
    super();
  }

  async start() {
    if (this.worker) {
      logger.warn("Worker already running");
      return;
    }

    // Initialize Redis
    this.redisClient = await broadcastsQueue.client;
    await this.redisClient.ping();
    logger.info("Redis connection established");

    // Initialize database
    this.db = await initDB();
    logger.info("Database connection established");

    // Initialize bot
    this.initBot();

    // Start BullMQ worker to process notification jobs
    this.worker = new Worker<NotifyJobData>(
      ANNOUNCEMENTS_NOTIFY_QUEUE,
      this.processJobWrapper.bind(this),
      {
        connection: workerRedisConnectionOptions,
        concurrency: 1,
      }
    );

    this.worker.on("completed", this.onJobCompleted.bind(this));
    this.worker.on("failed", this.onJobFailed.bind(this));

    // Trigger initial notification check on startup
    await this.scheduleInitialNotificationCheck();

    // Set up recurring jobs (called once - BullMQ handles the schedule)
    await setupRecurringSchedule();

    logger.info("Announcements notify worker started");
  }

  async stop() {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }

    await announcementsNotifyQueue.close();
    await closeDB();
    logger.info("Worker stopped");
  }

  protected async processJob(job: Job<NotifyJobData>) {
    logger.info(`Processing announcement notification job ${job.id}`);
    await this.processNewAnnouncements();
    logger.info(`Completed announcement notification job ${job.id}`);
  }

  private onJobCompleted(job: Job<NotifyJobData>) {
    logger.info({ jobId: job.id }, "Notification job completed");
  }

  private onJobFailed(job: Job<NotifyJobData> | undefined, error: Error) {
    logger.error({ jobId: job?.id, error }, "Notification job failed");
  }

  private async scheduleInitialNotificationCheck(): Promise<void> {
    logger.info("Scheduling initial announcement notification check");
    await announcementsNotifyQueue.add(
      "announcements-notify:initial",
      {
        scheduledAt: Date.now(),
      },
      {
        jobId: `announcement-notify-initial-${Date.now()}`,
      }
    );
  }

  private async getNewAnnouncements(): Promise<Announcement[]> {
    logger.info("Checking for new announcements");

    // Fetch latest announcements from API
    const announcements = await fetchAnnouncements({
      pageNumber: 0,
      dataSize: AnnouncementsNotifyWorkerConfig.DATA_LOOKUP_LIMIT,
      cache: false, // Always fetch fresh data
    });
    this.fetchedAnnouncements = announcements;

    // Find the new announcements by comparing IDs with buffer
    const latestIds = announcements.map(a => a.id).sort((a, b) => b - a);
    const announcementsBufferRepo = new AnnouncementsBufferRepository(this.db);
    const existingIds = await announcementsBufferRepo.getAllAnnouncementIds();

    // If no new IDs, return early
    const newIds = latestIds.filter(id => !existingIds.includes(id));
    if (newIds.length === 0) {
      logger.info("No new announcements found");
      return [];
    }

    // Find and return the new announcements
    const newAnnouncements = announcements.filter(a => newIds.includes(a.id));
    logger.info({ count: newAnnouncements.length }, "Found new announcements");
    return newAnnouncements;
  }

  // Method to completely resync the announcements buffer
  // This will basically clear the buffer and re-add all current announcements
  private async resyncAnnouncementsBuffer(): Promise<void> {
    logger.info("Resyncing announcements buffer");

    await withTransaction(async tx => {
      const bufferRepo = new AnnouncementsBufferRepository(tx);
      await bufferRepo.clear();
      await bufferRepo.addAll(this.fetchedAnnouncements.map(a => a.id));
    });

    logger.info("Announcements buffer resynced");
  }

  private async findRelevantSubscribers(
    announcement: Announcement
  ): Promise<number[]> {
    // Extract course filters from announcement text
    const filters = findCourseFiltersFromText(
      announcement.message || announcement.subject
    );

    // Check relevancy for general-only announcements using LLM
    if (filters.size === 1 && filters.has(AnnouncementFilter.ALL)) {
      // We don't know how many notifications will never match any filters
      // There can be a case where many such announcements come in a short span
      // In such a case, lot of requests will be sent in a short burst
      // Since this is anyways async, we can afford to add a small delay between requests
      await new Promise(resolve => setTimeout(resolve, 2 * 1000));
      logger.debug("No specific filters found, checking relevancy with LLM");
      const llmService = new LLMService();
      const isRelevant = await llmService.isAnnouncementRelevant(
        announcement.message || announcement.subject
      );

      // If relevant, add "relevant" filter to send to all relevant subscribers
      if (isRelevant) {
        logger.debug("Announcement deemed relevant by LLM");
        filters.add(AnnouncementFilter.RELEVANT);
      }
    }

    // Finally, add the "all" filter to send to announcement to subscribers who have subscribed to all announcements
    filters.add(AnnouncementFilter.ALL);

    // Find subscribers matching any of these filters
    const subscriptionRepo = new AnnouncementSubscriptionRepository(this.db);
    const subscribers = await subscriptionRepo.getMatchingSubscriptions(
      Array.from(filters)
    );
    return subscribers.map(sub => sub.chatId);
  }

  protected prepareFormattedMessage(
    announcement: Announcement
  ): FormattedString {
    const parts: FormattedString[] = [];

    // Add the header
    parts.push(
      fmt`${b}${emoji("loudspeaker")} New KTU Announcement ${emoji("loudspeaker")}${b}`
    );

    // Add subject if present
    if (announcement.subject) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("open_book")} Subject:${b}`,
          fmt`${announcement.subject}`,
        ])
      );
    }

    // Add message if present
    if (announcement.message) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("memo")} Message:${b}`,
          fmt`${announcement.message}`,
        ])
      );
    }

    // Add date if present
    if (announcement.formattedPublishedDate) {
      parts.push(
        fmt`${b}${emoji("calendar")} Date:${b} ${announcement.formattedPublishedDate}`
      );
    }

    // Use the utility function to combine formatted strings properly
    return combineFormattedDouble(parts);
  }

  private async processNewAnnouncements() {
    // Get new announcements, if none, return
    const newAnnouncements = await this.getNewAnnouncements();
    if (newAnnouncements.length === 0) return;

    // Create broadcast jobs for each announcement
    const jobs: BroadcastJob[] = [];

    // For each announcement:
    // 1. Find relevant subscribers, if none, skip
    // 2. Format the announcement message
    // 3. Process attachments to get file IDs/URLs
    // 4. Create one job per subscriber and push to jobs array
    for (const announcement of newAnnouncements) {
      const chatIds = await this.findRelevantSubscribers(announcement);
      if (chatIds.length === 0) {
        logger.debug(
          { announcementId: announcement.id },
          `No relevant subscribers for announcement`
        );
        continue;
      }

      const formattedText = this.prepareFormattedMessage(announcement);
      const processedAttachments = announcement.attachments
        ? await this.processAttachments(announcement.attachments)
        : [];

      for (const chatId of chatIds) {
        jobs.push({
          formattedText: formattedText,
          attachments: processedAttachments,
          timestamp: new Date(),
          chatId: chatId,
        });
      }
    }

    // Finally, add all jobs to queue in batch
    // This is done to make this operation atomic and idempotent
    // In case of a failure, everything fails so it will be retried in the next cron run
    if (jobs.length > 0) {
      await addBroadcastJobs(jobs);
      logger.info({ jobCount: jobs.length }, "Added broadcast jobs to queue");
    }

    // Resync the announcements buffer
    // Must be done only after successfully adding all jobs to the queue
    // This is because if the job queueing fails, we want to retry sending notifications in the next cron run
    await this.resyncAnnouncementsBuffer();
  }

  async getStatus() {
    const isRunning = this.worker !== null;
    const queueHealth = await checkQueueHealth(announcementsNotifyQueue, {
      maxFailedJobs:
        AnnouncementsNotifyWorkerConfig.HEALTH_CHECK.MAX_FAILED_JOBS,
      maxBacklogJobs:
        AnnouncementsNotifyWorkerConfig.HEALTH_CHECK.MAX_BACKLOG_JOBS,
    });

    return {
      isRunning,
      queueHealth,
    };
  }
}
