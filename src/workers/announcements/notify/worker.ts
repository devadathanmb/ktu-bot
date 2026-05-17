import { Job } from "bullmq";
import { fetchAnnouncements, LLMService } from "../../../api/services/index.js";
import { baseApiClient } from "../../../api/client.js";
import { AnnouncementsBufferRepository } from "../../../db/repositories/announcements-buffer-repository.js";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/announcement-subscription-repository.js";
import { Announcement } from "../../../types/service.types.js";
import findCourseFiltersFromText from "../../../utils/find-course-filters-from-text.js";
import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcements-notify-worker.js";
import { BaseWorker } from "../../base/base-worker.js";
import { addBroadcastJobs } from "../../broadcasts/queue.js";
import { fmt, b } from "@grammyjs/parse-mode";
import { FormattedString } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { BroadcastJob } from "../../shared/types.js";
import {
  AnnouncementFilter,
  POSTGRADUATE_COURSES,
  UNDERGRADUATE_COURSES,
} from "../../../constants/courses.js";
import { announcementsNotifyQueue, setupRecurringSchedule } from "./queue.js";
import logger from "../../../utils/logger.js";
import { withTransaction } from "../../../db/transactions.js";
import { createBot } from "../../../bot/bot.js";
import { apiThrottler } from "@grammyjs/transformer-throttler";
import { autoRetry } from "@grammyjs/auto-retry";
import { processAttachments } from "../../shared/utils/attachment-processor.js";
import { setTimeout } from "node:timers/promises";

export class AnnouncementsNotifyWorker extends BaseWorker<
  Record<string, never>
> {
  private fetchedAnnouncements: Announcement[] = [];
  private llmService = new LLMService();

  constructor() {
    super("announcements-notify-worker", announcementsNotifyQueue, {
      concurrency: 1,
      healthCheck: {
        maxFailedJobs: AnnouncementsNotifyWorkerConfig.MAX_FAILED_JOBS,
        maxBacklogJobs: AnnouncementsNotifyWorkerConfig.MAX_BACKLOG_JOBS,
        failedJobsLookbackMinutes:
          AnnouncementsNotifyWorkerConfig.FAILED_JOBS_WINDOW_MINUTES,
      },
    });
  }

  protected override initializeWorkerSpecific(): Promise<void> {
    const bot = createBot();
    bot.api.config.use(apiThrottler());
    bot.api.config.use(autoRetry({ maxRetryAttempts: 5 }));
    this.bot = bot;
    logger.info("Bot instance created with throttler and auto-retry");
    return Promise.resolve();
  }

  protected override async onStartupComplete(): Promise<void> {
    await this.scheduleInitialNotificationCheck();

    await setupRecurringSchedule();
  }

  protected async processJob(job: Job<Record<string, never>>): Promise<void> {
    logger.info({ jobId: job.id }, "Processing announcement notification job");
    await this.processNewAnnouncements();
    logger.info({ jobId: job.id }, "Completed announcement notification job");
  }

  private async scheduleInitialNotificationCheck(): Promise<void> {
    logger.info("Scheduling initial announcement notification check");
    await announcementsNotifyQueue.add(
      "announcements-notify:initial",
      {},
      {
        jobId: `announcement-notify-initial-${Date.now()}`,
      }
    );
  }

  private async getNewAnnouncements(): Promise<Announcement[]> {
    logger.info("Checking for new announcements");

    const announcements = await fetchAnnouncements({
      pageNumber: 0,
      dataSize: AnnouncementsNotifyWorkerConfig.DATA_LOOKUP_LIMIT,
      apiClient: baseApiClient,
    });
    this.fetchedAnnouncements = announcements;

    const latestIds = announcements.map(a => a.id).sort((a, b) => b - a);
    const announcementsBufferRepo = new AnnouncementsBufferRepository(this.db);
    const existingIds = await announcementsBufferRepo.getAllAnnouncementIds();

    const newIds = latestIds.filter(id => !existingIds.includes(id));
    if (newIds.length === 0) {
      logger.info("No new announcements found");
      return [];
    }

    const newAnnouncements = announcements.filter(a => newIds.includes(a.id));
    const count = newAnnouncements.length;
    logger.info({ count }, "Found new announcements");
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
    const content = {
      subject: announcement.subject || "",
      message: announcement.message || "",
    };
    const contentText = JSON.stringify(content);

    const filters = findCourseFiltersFromText(contentText);
    const announcementContent = content;
    const extractedFilters = Array.from(filters);

    logger.debug(
      {
        announcement: announcementContent,
        filters: extractedFilters,
      },
      "Regex extracted course filters from announcement"
    );

    // If more than one filter is matched, then it's likely matching UG and PG courses
    // But the announcement in itself may not be relevant to all those courses
    // Hence, we need to rely on LLM to check the relevant courses for such announcements
    if (
      filters.size == UNDERGRADUATE_COURSES.size ||
      filters.size == POSTGRADUATE_COURSES.size
    ) {
      // Find the filters using LLM
      // If LLM finds any specific courses, we will override the filters found so far
      // Otherwise, we will keep the existing filters
      logger.debug(
        "Multiple course filters found, using LLM to determine specific relevant courses"
      );
      const llmMatchedCourses =
        await this.llmService.findRelevantCoursesFromAnnouncement(contentText);
      logger.debug(
        {
          llmMatchedCourses: Array.from(llmMatchedCourses),
          announcement: announcementContent,
        },
        "LLM matched courses from announcement"
      );
      if (llmMatchedCourses.size > 0) {
        filters.clear();
        llmMatchedCourses.forEach(courseCode => {
          filters.add(courseCode as AnnouncementFilter);
        });
      }
    }

    // Check relevancy for general-only announcements using LLM
    if (filters.size === 1 && filters.has(AnnouncementFilter.ALL)) {
      // We don't know how many notifications will never match any filters
      // There can be a case where many such announcements come in a short span
      // In such a case, lot of requests will be sent in a short burst
      // Since this is anyways async, we can afford to add a small delay between requests
      await setTimeout(2 * 1000);

      logger.debug("No specific filters found, checking relevancy with LLM");
      const isRelevant =
        await this.llmService.isAnnouncementRelevant(contentText);

      // If relevant, add all available filters to send to all subscribers
      // If the announcement is relevant, then it should be sent to all subscribes no matter what filters they have subscribed to
      if (isRelevant) {
        logger.debug(
          "Announcement deemed relevant by LLM, adding all filters to reach all subscribers"
        );
        Object.values(AnnouncementFilter).forEach(filter => {
          filters.add(filter);
        });
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
        joinWithNewlines([
          fmt`${b}${emoji("open_book")} Subject:${b}`,
          fmt`${announcement.subject}`,
        ])
      );
    }

    // Add message if present
    if (announcement.message) {
      parts.push(
        joinWithNewlines([
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
    return joinWithNewlines(parts, 2);
  }

  private async processNewAnnouncements() {
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
        const announcementId = announcement.id;
        logger.debug(
          { announcementId },
          "No relevant subscribers for announcement"
        );
        continue;
      }

      const formattedText = this.prepareFormattedMessage(announcement);
      const processedAttachments = announcement.attachments
        ? await processAttachments(this.getBot(), announcement.attachments)
        : [];

      for (const chatId of chatIds) {
        jobs.push({
          formattedText: formattedText,
          attachments: processedAttachments,
          chatId: chatId,
        });
      }
    }

    // This is done to make this operation atomic and idempotent
    // In case of a failure, everything fails so it will be retried in the next cron run
    if (jobs.length > 0) {
      await addBroadcastJobs(jobs);
      const jobCount = jobs.length;
      logger.info({ jobCount }, "Added broadcast jobs to queue");
    }

    // Resync the announcements buffer
    // Must be done only after successfully adding all jobs to the queue
    // This is because if the job queueing fails, we want to retry sending notifications in the next cron run
    await this.resyncAnnouncementsBuffer();
  }
}
