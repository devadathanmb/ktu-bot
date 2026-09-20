import type { FormattedString } from "@grammyjs/parse-mode";
import type { Announcement, Attachment } from "../../../types/service.types.js";
import type { BroadcastJobInput } from "../../broadcasts/queue.js";
import type { ProcessedAttachment } from "../../shared/types.js";
import logger from "../../../utils/logger.js";

// Narrow function seams for the external boundaries of one notification run.
// The processor supplies the database, bot, and queue implementations.
export interface AnnouncementNotificationDeps {
  findSubscriberChatIds(announcement: Announcement): Promise<number[]>;
  processAttachments(attachments: Attachment[]): Promise<ProcessedAttachment[]>;
  prepareFormattedText(announcement: Announcement): FormattedString;
  enqueueBroadcasts(jobs: BroadcastJobInput[]): Promise<unknown>;
  replaceBuffer(announcementIds: number[]): Promise<void>;
}

export async function enqueueNewAnnouncementBroadcasts(
  fetchedAnnouncements: Announcement[],
  bufferedAnnouncementIds: number[],
  deps: AnnouncementNotificationDeps
): Promise<void> {
  const newAnnouncements = fetchedAnnouncements.filter(
    announcement => !bufferedAnnouncementIds.includes(announcement.id)
  );

  if (newAnnouncements.length === 0) {
    logger.info("No new announcements found");
    return;
  }

  const count = newAnnouncements.length;
  logger.info({ count }, "Found new announcements");

  const jobs: BroadcastJobInput[] = [];

  for (const announcement of newAnnouncements) {
    const chatIds = await deps.findSubscriberChatIds(announcement);
    if (chatIds.length === 0) {
      logger.debug(
        { announcementId: announcement.id },
        "No relevant subscribers for announcement"
      );
      continue;
    }

    const formattedText = deps.prepareFormattedText(announcement);
    const processedAttachments = announcement.attachments
      ? await deps.processAttachments(announcement.attachments)
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

  // Redis queue writes and the database buffer replacement are not atomic.
  // Replace the buffer only after all queue writes succeed.
  if (jobs.length > 0) {
    await deps.enqueueBroadcasts(jobs);
    logger.info({ jobCount: jobs.length }, "Added broadcast jobs to queue");
  }

  await deps.replaceBuffer(fetchedAnnouncements.map(a => a.id));
}
