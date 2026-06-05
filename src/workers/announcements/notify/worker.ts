import { Job } from "bullmq";
import { fetchAnnouncements, LLMService } from "../../../api/services/index.js";
import { baseApiClient } from "../../../api/client.js";
import { AnnouncementsBufferRepository } from "../../../db/repositories/announcements-buffer-repository.js";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/announcement-subscription-repository.js";
import { Announcement } from "../../../types/service.types.js";
import findCourseFiltersFromText from "../../../utils/find-course-filters-from-text.js";
import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcements-notify-worker.js";
import { BaseWorker } from "../../base/base-worker.js";
import {
  addBroadcastJobs,
  type BroadcastJobInput,
} from "../../broadcasts/queue.js";
import { fmt, b } from "@grammyjs/parse-mode";
import { FormattedString } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import {
  addAllStudentAudienceFilters,
  addUniversalSubscriptionFilters,
  hasSpecificAudienceFilters,
  isOnlyAllAnnouncementsFilter,
  shouldRefineBroadCourseMatch,
} from "./audience.js";
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

    let isStudentRelevant = hasSpecificAudienceFilters(filters);

    // Broad phrases like "UG" or "PG" expand to every course in that group.
    // That is useful for reach, but too coarse for notifications, so we ask the
    // LLM for a narrower course list only when the extracted set actually
    // contains the whole UG/PG group instead of relying on set size alone.
    if (shouldRefineBroadCourseMatch(filters)) {
      logger.debug(
        "Broad course filters found, using LLM to determine specific relevant courses"
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
          filters.add(courseCode);
        });
      }
      isStudentRelevant = true;
    }

    // General announcements with no course signal need an LLM relevance check.
    // If relevant, we target every course filter plus `RELEVANT`; if not, only
    // `ALL` subscribers receive it via addUniversalSubscriptionFilters below.
    if (isOnlyAllAnnouncementsFilter(filters)) {
      // Stagger LLM calls to avoid bursts
      await setTimeout(2 * 1000);

      logger.debug("No specific filters found, checking relevancy with LLM");
      const isRelevant =
        await this.llmService.isAnnouncementRelevant(contentText);

      if (isRelevant) {
        logger.debug(
          "Announcement deemed relevant by LLM, adding all student audience filters"
        );
        addAllStudentAudienceFilters(filters);
      }
      isStudentRelevant = isRelevant;
    }

    addUniversalSubscriptionFilters(filters, { isStudentRelevant });

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

    return joinWithNewlines(parts, 2);
  }

  private async processNewAnnouncements() {
    const newAnnouncements = await this.getNewAnnouncements();
    if (newAnnouncements.length === 0) return;

    // Create broadcast jobs for each announcement
    const jobs: BroadcastJobInput[] = [];

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
          data: {
            formattedText: formattedText,
            attachments: processedAttachments,
            chatId: chatId,
          },
          jobId: `announcement-${announcement.id}-chat-${chatId}`,
        });
      }
    }

    // Atomic + idempotent: buffer resync only after queue succeeds
    if (jobs.length > 0) {
      await addBroadcastJobs(jobs);
      const jobCount = jobs.length;
      logger.info({ jobCount }, "Added broadcast jobs to queue");
    }

    await this.resyncAnnouncementsBuffer();
  }
}
