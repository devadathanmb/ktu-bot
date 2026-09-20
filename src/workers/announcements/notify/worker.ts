import type { Job } from "bullmq";
import { fetchAnnouncements } from "../../../api/services/ktu/index.js";
import { baseApiClient } from "../../../api/client.js";
import { AnnouncementsBufferRepository } from "../../../db/repositories/announcements-buffer-repository.js";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/announcement-subscription-repository.js";
import type { Announcement } from "../../../types/service.types.js";
import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcements-notify-worker.js";
import { addBroadcastJobs } from "../../broadcasts/queue.js";
import { fmt, b, type FormattedString } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import type { AnnouncementAudienceResolver } from "./audience.js";
import { enqueueNewAnnouncementBroadcasts } from "./orchestration.js";
import logger from "../../../utils/logger.js";
import { withTransaction } from "../../../db/transactions.js";
import { processAttachments } from "../../shared/utils/attachment-processor.js";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as schema from "../../../db/schema/index.js";
import type { Bot } from "grammy";
import type { BotContext } from "../../../types/bot.types.js";

export class AnnouncementsNotifyProcessor {
  constructor(
    private readonly db: NodePgDatabase<typeof schema>,
    private readonly bot: Bot<BotContext>,
    private readonly resolveAudience: AnnouncementAudienceResolver
  ) {}

  async process(job: Job<Record<string, never>>): Promise<void> {
    logger.info({ jobId: job.id }, "Processing announcement notification job");
    await this.processNewAnnouncements();
    logger.info({ jobId: job.id }, "Completed announcement notification job");
  }

  private async processNewAnnouncements(): Promise<void> {
    const fetchedAnnouncements = await fetchAnnouncements({
      pageNumber: 0,
      dataSize: AnnouncementsNotifyWorkerConfig.DATA_LOOKUP_LIMIT,
      apiClient: baseApiClient,
    });

    const bufferedAnnouncementIds = await this.getBufferedAnnouncementIds();

    await enqueueNewAnnouncementBroadcasts(
      fetchedAnnouncements,
      bufferedAnnouncementIds,
      {
        findSubscriberChatIds: announcement =>
          this.findRelevantSubscribers(announcement),
        processAttachments: attachments =>
          processAttachments(this.bot, attachments),
        prepareFormattedText: announcement =>
          this.prepareFormattedMessage(announcement),
        enqueueBroadcasts: addBroadcastJobs,
        replaceBuffer: announcementIds =>
          this.resyncAnnouncementsBuffer(announcementIds),
      }
    );
  }

  private async getBufferedAnnouncementIds(): Promise<number[]> {
    logger.info("Checking for new announcements");

    const announcementsBufferRepo = new AnnouncementsBufferRepository(this.db);
    return announcementsBufferRepo.getAllAnnouncementIds();
  }

  private async resyncAnnouncementsBuffer(
    announcementIds: number[]
  ): Promise<void> {
    logger.info("Resyncing announcements buffer");

    await withTransaction(async tx => {
      const bufferRepo = new AnnouncementsBufferRepository(tx);
      await bufferRepo.clear();
      await bufferRepo.addAll(announcementIds);
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

    const { filters } = await this.resolveAudience(JSON.stringify(content));

    // Find subscribers matching any of these filters
    const subscriptionRepo = new AnnouncementSubscriptionRepository(this.db);
    const subscribers = await subscriptionRepo.getMatchingSubscriptions(
      Array.from(filters)
    );
    return subscribers.map(sub => sub.chatId);
  }

  private prepareFormattedMessage(announcement: Announcement): FormattedString {
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
}
