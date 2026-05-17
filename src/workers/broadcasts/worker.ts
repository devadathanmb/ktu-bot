import { Job } from "bullmq";
import { GrammyError, InputMediaBuilder } from "grammy";
import { BroadcastJob, ProcessedAttachment } from "../shared/types.js";
import { FormattedString } from "@grammyjs/parse-mode";
import logger from "../../utils/logger.js";
import { BaseWorker } from "../base/base-worker.js";
import { createWorkerBot } from "../../bot/utils/create-worker-bot.js";
import { TelegramErrorUtils } from "../shared/utils/telegram-error-utils.js";
import { AnnouncementSubscriptionRepository } from "../../db/repositories/announcement-subscription-repository.js";
import { broadcastsQueue } from "./queue.js";
import { BroadcastsWorkerConfig } from "../../configs/broadcasts-worker.js";

export class BroadcastsWorker extends BaseWorker<BroadcastJob> {
  constructor() {
    super("broadcasts-worker", broadcastsQueue, {
      concurrency: 1,
      healthCheck: {
        maxFailedJobs: BroadcastsWorkerConfig.MAX_FAILED_JOBS,
        maxBacklogJobs: BroadcastsWorkerConfig.MAX_BACKLOG_JOBS,
        failedJobsLookbackMinutes:
          BroadcastsWorkerConfig.FAILED_JOBS_WINDOW_MINUTES,
      },
    });
  }

  protected override initializeWorkerSpecific(): Promise<void> {
    this.bot = createWorkerBot();
    logger.info("Bot instance created");
    return Promise.resolve();
  }

  protected override async processJob(job: Job<BroadcastJob>): Promise<void> {
    try {
      await this.processBroadcastJob(job);
    } catch (error) {
      if (error instanceof GrammyError) {
        await TelegramErrorUtils.handleWorkerGrammyError(
          job.data.chatId,
          error,
          this.queue
        );
      } else {
        TelegramErrorUtils.logUnhandledGenericError(job.id, error as Error);
      }
    }
  }

  private async processBroadcastJob(job: Job<BroadcastJob>): Promise<void> {
    const { formattedText, attachments, chatId } = job.data;

    // By the time the job has reached broadcasts worker, the user may have blocked the bot
    // Hence, we should verify if the subscription still exists before sending
    // Otherwise we are just wasting API calls and risking rate limits
    const subscriptionRepo = new AnnouncementSubscriptionRepository(this.db);
    const subscriptionExists = await subscriptionRepo.exists(chatId);
    if (!subscriptionExists) return;

    if (!attachments || attachments.length === 0) {
      await this.sendMessage(chatId, formattedText);
      return;
    }

    const batchSize = 10;
    const batches: ProcessedAttachment[][] = [];

    for (let i = 0; i < attachments.length; i += batchSize) {
      batches.push(attachments.slice(i, i + batchSize));
    }

    if (batches.length > 0) {
      const message = await this.sendMessageWithAttachmentsAsMediaGroup(
        chatId,
        formattedText,
        batches[0]!
      );

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

  private async sendMessage(chatId: number, formattedText: FormattedString) {
    return await this.getBot().api.sendMessage(chatId, formattedText.rawText, {
      entities: formattedText.rawEntities,
      link_preview_options: { is_disabled: true },
    });
  }

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

    return await this.getBot().api.sendMediaGroup(chatId, documents);
  }

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

    return await this.getBot().api.sendMediaGroup(chatId, documents, params);
  }
}
