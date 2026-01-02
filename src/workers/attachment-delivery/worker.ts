import { Job } from "bullmq";
import { GrammyError, InputMediaBuilder, InputFile } from "grammy";
import { AttachmentDeliveryJob, attachmentDeliveryQueue } from "./queue.js";
import { Attachment } from "../../types/service.types.js";
import { createGrammyInputFileFromAttachment } from "../../utils/fileUtils.js";
import { AnnouncementSubscriptionRepository } from "../../db/repositories/AnnouncementSubscriptionRepository.js";
import { ChatRepository } from "../../db/repositories/ChatRepository.js";
import { withTransaction } from "../../db/transactions.js";
import { BaseWorker } from "../base/BaseWorker.js";
import { createWorkerBot } from "../../bot/utils/createWorkerBot.js";
import { setTimeout } from "node:timers/promises";
import logger from "../../utils/logger.js";
import { emoji } from "@grammyjs/emoji";
import { ATTACHMENT_DELIVERY_QUEUE } from "./queue.js";

export class AttachmentDeliveryWorker extends BaseWorker<AttachmentDeliveryJob> {
  constructor() {
    super(
      "attachment-delivery-worker",
      ATTACHMENT_DELIVERY_QUEUE,
      attachmentDeliveryQueue,
      { concurrency: 2 }
    );
  }

  protected override initializeWorkerSpecific(): Promise<void> {
    this.bot = createWorkerBot();
    logger.info("Bot instance created");
    return Promise.resolve();
  }

  protected override async processJob(
    job: Job<AttachmentDeliveryJob>
  ): Promise<void> {
    try {
      await this.processAttachmentDeliveryJob(job);
    } catch (error) {
      if (error instanceof GrammyError) {
        const chatId = job.data.chatId;
        const errorCode = error.error_code;
        const errorDescription = error.description;

        const isUserBlockedError =
          errorCode === 403 ||
          (errorCode === 400 && errorDescription.includes("USER_IS_BLOCKED"));

        const isUserDeactivatedError =
          (errorCode === 403 && errorDescription.includes("deactivated")) ||
          (errorCode === 400 && errorDescription.includes("USER_DEACTIVATED"));

        if (isUserBlockedError) {
          logger.warn(
            { chatId, error: errorDescription },
            "User blocked the bot, updating status"
          );
          await this.handleBlockedUser(chatId);
        } else if (isUserDeactivatedError) {
          logger.warn(
            { chatId, error: errorDescription },
            "User deactivated their account, removing chat"
          );
          await this.handleDeactivatedUser(chatId);
        } else if (errorCode === 429) {
          const retryAfter = error.parameters?.retry_after || 30;
          const duration = retryAfter * 1000 + 1000;

          logger.warn(
            { chatId, retryAfter, duration },
            "Rate limited by Telegram, pausing entire queue"
          );

          await this.handleRateLimit(duration);
        } else {
          this.handleTelegramError(error, chatId);
        }
      } else {
        this.handleGenericError(error as Error, job);
      }
    }
  }

  private async processAttachmentDeliveryJob(
    job: Job<AttachmentDeliveryJob>
  ): Promise<void> {
    const { chatId, attachments, statusMessageId, replyToMessageId, context } =
      job.data;

    const downloadedFiles: Array<{
      inputFile: InputFile;
      attachment: Attachment;
    }> = [];

    try {
      for (const attachment of attachments) {
        const inputFile = await createGrammyInputFileFromAttachment(
          attachment.encryptId,
          attachment.name
        );
        downloadedFiles.push({ inputFile, attachment });
      }

      const caption = this.buildCaption(attachments, context);

      const batchSize = 10;
      for (let i = 0; i < downloadedFiles.length; i += batchSize) {
        const batch = downloadedFiles.slice(i, i + batchSize);
        const firstInBatch = i === 0;

        const mediaGroup = batch.map((item, index) => {
          const params: Record<string, unknown> = {};
          if (firstInBatch && index === 0 && caption) {
            params.caption = caption;
          }

          return InputMediaBuilder.document(item.inputFile, params);
        });

        const replyParams = replyToMessageId
          ? {
              reply_parameters: {
                message_id: replyToMessageId,
                allow_sending_without_reply: true,
              },
            }
          : undefined;

        await this.bot!.api.sendMediaGroup(chatId, mediaGroup, replyParams);
      }

      if (statusMessageId !== undefined) {
        await this.deleteStatusMessage(chatId, statusMessageId);
      }
    } catch (error) {
      if (statusMessageId !== undefined) {
        await this.updateErrorMessage(chatId, statusMessageId);
      }
      throw error;
    }
  }

  private buildCaption(attachments: Attachment[], context: string): string {
    if (attachments.length === 0) return "";

    const contextEmoji = this.getContextEmoji(context);
    const lines = [
      `${contextEmoji} Attachments:`,
      ...attachments.map(a => a.name),
    ];

    return lines.join("\n");
  }

  private getContextEmoji(context: string): string {
    const emojiMap: Record<string, string> = {
      "calendar": emoji("calendar"),
      "timetable": emoji("books"),
      "announcement": emoji("paperclip"),
      "inline query result": emoji("paperclip"),
    };
    return emojiMap[context] || emoji("paperclip");
  }

  private async deleteStatusMessage(
    chatId: number,
    messageId: number
  ): Promise<void> {
    try {
      await this.bot!.api.deleteMessage(chatId, messageId);
      logger.debug({ chatId, messageId }, "Deleted status message");
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 400) {
        logger.debug(
          { chatId, messageId },
          "Status message already deleted, ignoring"
        );
      } else {
        throw error;
      }
    }
  }

  private async updateErrorMessage(
    chatId: number,
    messageId: number
  ): Promise<void> {
    try {
      await this.bot!.api.editMessageText(
        chatId,
        messageId,
        `${emoji("crying_cat")} Oops! Something went wrong. Please try again.`
      );
    } catch (error) {
      if (error instanceof GrammyError && error.error_code === 400) {
        logger.debug(
          { chatId, messageId },
          "Status message deleted by user, skipping error update"
        );
      } else {
        throw error;
      }
    }
  }

  private async handleBlockedUser(chatId: number): Promise<void> {
    await withTransaction(async tx => {
      const subscriptionRepo = new AnnouncementSubscriptionRepository(tx);
      const chatRepo = new ChatRepository(tx);

      await subscriptionRepo.delete(chatId);
      await chatRepo.createIfNotExists(chatId);
      await chatRepo.markKicked(chatId);
    });
  }

  private async handleDeactivatedUser(chatId: number): Promise<void> {
    await withTransaction(async tx => {
      const chatRepo = new ChatRepository(tx);
      await chatRepo.delete(chatId);
    });
  }

  private async handleRateLimit(duration: number): Promise<void> {
    logger.info({ pauseDuration: duration }, "Pausing queue due to rate limit");

    await attachmentDeliveryQueue.pause();

    await setTimeout(duration);

    await attachmentDeliveryQueue.resume();
  }

  private handleTelegramError(error: GrammyError, chatId: number): void {
    logger.error(
      { chatId, errorCode: error.error_code, error: error.description },
      "Unhandled Telegram error"
    );
  }

  private handleGenericError(
    error: Error,
    job: Job<AttachmentDeliveryJob>
  ): void {
    logger.error(
      { jobId: job.id, error },
      "Unhandled generic error in job processing"
    );
  }
}
