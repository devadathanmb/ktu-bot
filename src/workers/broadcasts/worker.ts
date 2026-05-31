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
import {
  buildFormattedCaption,
  buildReplyParameters,
} from "../shared/utils/telegram-send.js";

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
        throw error;
      }
    }
  }

  private async processBroadcastJob(job: Job<BroadcastJob>): Promise<void> {
    const { formattedText, attachments, chatId } = job.data;

    // Skip if user unsubscribed while job was queued
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
      const firstBatchMessage = await this.sendAttachmentsBatch(
        chatId,
        batches[0]!,
        {
          formattedText,
        }
      );

      for (let i = 1; i < batches.length; i++) {
        await this.sendAttachmentsBatch(chatId, batches[i]!, {
          messageIdToReplyTo: firstBatchMessage.message_id,
        });
      }
    }
  }

  private async sendMessage(chatId: number, formattedText: FormattedString) {
    return await this.getBot().api.sendMessage(chatId, formattedText.rawText, {
      entities: formattedText.rawEntities,
      link_preview_options: { is_disabled: true },
    });
  }

  private async sendAttachmentsBatch(
    chatId: number,
    attachments: ProcessedAttachment[],
    options: {
      formattedText?: FormattedString;
      messageIdToReplyTo?: number;
    } = {}
  ) {
    if (attachments.length === 1) {
      return await this.sendSingleAttachment(chatId, attachments[0]!, options);
    }

    const documents = attachments.map((attachment, index) => {
      const params =
        index === 0 ? buildFormattedCaption(options.formattedText) : undefined;

      return InputMediaBuilder.document(
        this.getAttachmentReference(attachment),
        params
      );
    });

    const messages = await this.getBot().api.sendMediaGroup(
      chatId,
      documents,
      buildReplyParameters(options)
    );

    return messages[0]!;
  }

  private async sendSingleAttachment(
    chatId: number,
    attachment: ProcessedAttachment,
    options: {
      formattedText?: FormattedString;
      messageIdToReplyTo?: number;
    }
  ) {
    return await this.getBot().api.sendDocument(
      chatId,
      this.getAttachmentReference(attachment),
      {
        ...buildFormattedCaption(options.formattedText),
        ...buildReplyParameters(options),
      }
    );
  }

  private getAttachmentReference(attachment: ProcessedAttachment): string {
    return "fileId" in attachment ? attachment.fileId : attachment.fileUrl;
  }
}
