import { Job } from "bullmq";
import { GrammyError, InputMediaBuilder } from "grammy";
import { BroadcastJob, ProcessedAttachment } from "../shared/types.js";
import { FormattedString } from "@grammyjs/parse-mode";
import logger from "../../utils/logger.js";
import { BaseWorker } from "../base/base-worker.js";
import { createWorkerBot } from "../../bot/utils/create-worker-bot.js";
import { TelegramErrorUtils } from "../shared/utils/telegram-error-handler.js";
import { AnnouncementSubscriptionRepository } from "../../db/repositories/announcement-subscription-repository.js";
import { BROADCASTS_QUEUE, broadcastsQueue } from "./queue.js";

export class BroadcastsWorker extends BaseWorker<BroadcastJob> {
  constructor() {
    super("broadcasts-worker", BROADCASTS_QUEUE, broadcastsQueue, {
      concurrency: 1,
    });
  }

  protected override initializeWorkerSpecific(): Promise<void> {
    // Initialize bot without special middlewares
    this.bot = createWorkerBot();
    logger.info("Bot instance created");
    return Promise.resolve();
  }

  protected override async processJob(job: Job<BroadcastJob>): Promise<void> {
    try {
      await this.processBroadcastJob(job);
    } catch (error) {
      if (error instanceof GrammyError) {
        const chatId = job.data.chatId;
        const errorCode = error.error_code;
        const errorDescription = error.description;

        if (
          TelegramErrorUtils.isUserBlockedError(errorCode, errorDescription)
        ) {
          const error = errorDescription;
          logger.warn(
            { chatId, error },
            "User blocked the bot, updating status"
          );
          await TelegramErrorUtils.handleBlockedUser(chatId);
        } else if (
          TelegramErrorUtils.isUserDeactivatedError(errorCode, errorDescription)
        ) {
          const error = errorDescription;
          logger.warn(
            { chatId, error },
            "User deactivated their account, removing subscriptions and deleting chat"
          );
          await TelegramErrorUtils.handleDeactivatedUser(chatId);
        } else if (TelegramErrorUtils.isRateLimitError(errorCode)) {
          const retryAfter = TelegramErrorUtils.getRateLimitDuration(error);
          await TelegramErrorUtils.handleRateLimitWithQueuePause(
            broadcastsQueue,
            retryAfter
          );
          // Re-throw so BullMQ marks the job as failed and retries it later.
          // Without this, the job is silently completed and the message to
          // this chatId is dropped forever. The queue pause protects future
          // jobs from hitting the same rate limit; the retry ensures this
          // specific broadcast is eventually delivered.
          throw error;
        } else {
          TelegramErrorUtils.logUnhandledTelegramError(
            chatId,
            errorCode,
            errorDescription
          );
        }
      } else {
        TelegramErrorUtils.logUnhandledGenericError(job.id, error as Error);
      }
    }
  }

  private async processBroadcastJob(job: Job<BroadcastJob>): Promise<void> {
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
    return await this.bot!.api.sendMessage(chatId, formattedText.rawText, {
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

    return await this.bot!.api.sendMediaGroup(chatId, documents);
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

    return await this.bot!.api.sendMediaGroup(chatId, documents, params);
  }
}
