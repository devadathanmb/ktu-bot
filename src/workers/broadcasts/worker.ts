import { Job } from "bullmq";
import { AnnouncementSubscriptionRepository } from "../../db/repositories/AnnouncementSubscriptionRepository.js";
import { ChatRepository } from "../../db/repositories/ChatRepository.js";
import { GrammyError, InputMediaBuilder } from "grammy";
import { BroadcastJob, ProcessedAttachment } from "../shared/types.js";
import { FormattedString } from "@grammyjs/parse-mode";
import logger from "../../utils/logger.js";
import { withTransaction } from "../../db/transactions.js";
import { BaseWorker } from "../base/BaseWorker.js";
import { createBot } from "../../bot/bot.js";
import { setTimeout } from "node:timers/promises";
import { BROADCASTS_QUEUE, broadcastsQueue } from "./queue.js";

export class BroadcastsWorker extends BaseWorker<BroadcastJob> {
  constructor() {
    super("broadcasts-worker", BROADCASTS_QUEUE, broadcastsQueue, {
      concurrency: 1,
    });
  }

  protected override initializeWorkerSpecific(): Promise<void> {
    // Initialize bot without special middlewares
    this.bot = createBot();
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

        // Telegram sends 403 for forbidden errors like bot being blocked by user
        // It sends 400 with description "Bad Request: USER_IS_BLOCKED" in some cases too
        const isUserBlockedError =
          errorCode === 403 ||
          (errorCode == 400 && errorDescription.includes("USER_IS_BLOCKED"));

        // If the user is deactivated, telegram throws a different error
        const isUserDeactivedError =
          (errorCode === 403 && errorDescription.includes("deactivated")) ||
          (errorCode === 400 && errorDescription.includes("USER_DEACTIVATED"));

        if (isUserBlockedError) {
          // User blocked the bot
          logger.warn(
            { chatId, error: errorDescription },
            "User blocked the bot, updating status"
          );
          await this.handleBlockedUser(chatId);
        } else if (isUserDeactivedError) {
          // User deactivated their account
          logger.warn(
            { chatId, error: errorDescription },
            "User deactivated their account, removing subscriptions and deleting chat"
          );
          await this.handleDeactivatedUser(chatId);
        } else if (errorCode === 429) {
          // Rate limited - pause the entire queue
          const retryAfter = error.parameters?.retry_after || 30;
          const duration = retryAfter * 1000 + 1000; // Add 1 second buffer

          logger.warn(
            { chatId, retryAfter, duration },
            "Rate limited by Telegram, pausing entire queue"
          );

          await this.handleRateLimit(duration);

          // Don't re-throw - let the job fail and retry naturally when queue resumes
          // The queue is paused, so retries won't happen until it's resumed
        } else {
          // Handle other Telegram errors
          this.handleTelegramError(error, chatId);
        }
      } else {
        // Handle non-Telegram errors
        this.handleGenericError(error as Error, job);
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

  /**
   * Handle user who blocked the bot
   */
  private async handleBlockedUser(chatId: number) {
    await withTransaction(async tx => {
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

  /*
   * Handle user who deactivated their account
   */
  private async handleDeactivatedUser(chatId: number) {
    await withTransaction(async tx => {
      const chatRepo = new ChatRepository(tx);
      await chatRepo.delete(chatId);
    });
  }

  /**
   * Handle rate limiting by pausing the queue and resuming after duration
   */
  private async handleRateLimit(duration: number): Promise<void> {
    logger.info({ pauseDuration: duration }, "Pausing queue due to rate limit");

    // Pause the entire queue
    await broadcastsQueue.pause();

    // Sleep for duration
    await setTimeout(duration);

    // Resume the queue
    await broadcastsQueue.resume();
  }

  private handleTelegramError(error: GrammyError, chatId: number): void {
    logger.error(
      { chatId, errorCode: error.error_code, error: error.description },
      "Unhandled Telegram error"
    );
  }

  private handleGenericError(error: Error, job: Job<BroadcastJob>): void {
    logger.error(
      { jobId: job.id, error },
      "Unhandled generic error in job processing"
    );
  }
}
