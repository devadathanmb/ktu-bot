import { emoji } from "@grammyjs/emoji";
import { fmt } from "@grammyjs/parse-mode";
import { CallbackQueryContext } from "grammy";
import { BotContext } from "../../../../types/bot.types.js";
import { Attachment, ExamTimeTable } from "../../../../types/service.types.js";
import { editMessageIgnoringNotModified } from "../../../../utils/bot.js";
import logger from "../../../../utils/logger.js";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import type { AttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";
import { createViewAnotherKeyboard } from "../../../utils/presentation.js";
import { timetableCommandInfo } from "../command-info.js";
import { LOOKUP_CONFIG } from "../constants.js";
import {
  fetchAndRenderApiPage,
  findItemById,
  handleApiNextPage,
  handleApiPreviousPage,
  parseSelectCallback,
  startApiPaginatedLookup,
  storeCallbackMessageId,
} from "../utils.js";
import { getTimetableAttachment } from "./attachments.js";
import {
  formatTimetableDetails,
  generateTimetablesKeyboard,
  generateTimetablesText,
} from "./views.js";

const MESSAGES = {
  FETCHING_TIMETABLES: [
    fmt`${emoji("hourglass_not_done")} Fetching timetables... Please wait...`,
  ],
};

type CallbackContext = CallbackQueryContext<BotContext>;

// Every dependency is required: the composer wires the live KTU fetcher and
// the attachment-delivery queue exactly once, and the flow closes over them.
export interface TimetableFlowDeps {
  fetchTimetables: (params: {
    pageNumber: number;
    dataSize: number;
  }) => Promise<ExamTimeTable[]>;
  queueDownload: (job: AttachmentDeliveryJob) => Promise<unknown>;
}

export interface TimetableFlow {
  start(ctx: BotContext): Promise<void>;
  select(ctx: CallbackContext): Promise<void>;
  viewAnother(ctx: CallbackContext): Promise<void>;
  end(ctx: CallbackContext): Promise<void>;
  previousPage(ctx: CallbackContext): Promise<void>;
  nextPage(ctx: CallbackContext): Promise<void>;
}

export function createTimetableFlow(deps: TimetableFlowDeps): TimetableFlow {
  function createLookupConfig() {
    return {
      messageIdSessionKey: "timetableMessageId" as const,
      getPage: (ctx: BotContext) => ctx.session.timetablePage,
      setPage: (ctx: BotContext, page: number | null) => {
        ctx.session.timetablePage = page;
      },
      getItems: (ctx: BotContext) => ctx.session.timetableTimetables,
      setItems: (ctx: BotContext, timetables: ExamTimeTable[]) => {
        ctx.session.timetableTimetables = timetables;
      },
      fetchPage: (pageNumber: number) =>
        deps.fetchTimetables({
          pageNumber,
          dataSize: LOOKUP_CONFIG.PAGE_SIZE,
        }),
      buildKeyboard: generateTimetablesKeyboard,
      buildText: generateTimetablesText,
      loadingMessage: joinWithNewlines(MESSAGES.FETCHING_TIMETABLES, 2),
    };
  }

  async function fetchAndDisplay(ctx: BotContext): Promise<void> {
    await fetchAndRenderApiPage(ctx, createLookupConfig());
  }

  async function renderSelection(
    ctx: BotContext,
    timetable: ExamTimeTable,
    attachment: Attachment | null
  ): Promise<void> {
    if (!attachment) {
      const noAttachmentMsg = joinWithNewlines(
        [
          formatTimetableDetails(timetable),
          fmt`${emoji("woman_shrugging")} No attachment found for this timetable.`,
        ],
        2
      );

      await ctx.editMessageText(noAttachmentMsg.text, {
        reply_markup: createViewAnotherKeyboard("timetable"),
        entities: noAttachmentMsg.entities,
      });
      return;
    }

    const detailsMsg = formatTimetableDetails(timetable);
    await ctx.editMessageText(detailsMsg.text, {
      entities: detailsMsg.entities,
    });
  }

  async function queueTimetableDownload(
    ctx: BotContext,
    attachment: Attachment
  ): Promise<void> {
    const statusMessage = await ctx.reply(
      `${emoji("hourglass_not_done")} Downloading your timetable in the background... This may take a moment!`
    );

    const jobData: AttachmentDeliveryJob = {
      chatId: ctx.chat!.id,
      attachments: [attachment],
      statusMessageId: statusMessage.message_id,
      context: "timetable",
      sendViewAnotherMessage: true,
    };

    if (ctx.msgId !== undefined) {
      jobData.replyToMessageId = ctx.msgId;
    }

    await deps.queueDownload(jobData);
  }

  async function start(ctx: BotContext): Promise<void> {
    if (ctx.session.timetablePage === null) {
      ctx.session.timetablePage = LOOKUP_CONFIG.INITIAL_PAGE;
    }

    const formattedMsg = joinWithNewlines(MESSAGES.FETCHING_TIMETABLES, 2);
    const loadingMessage = await ctx.reply(formattedMsg.text, {
      entities: formattedMsg.entities,
    });
    ctx.session.timetableMessageId = loadingMessage.message_id;

    await startApiPaginatedLookup(
      ctx,
      createLookupConfig(),
      loadingMessage.message_id
    );
  }

  async function select(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();

    const parsed = parseSelectCallback(ctx.callbackQuery.data, "timetable");
    if (!parsed.isValid) {
      await editMessageIgnoringNotModified(() =>
        ctx.editMessageText(
          `${emoji("cross_mark")} Invalid callback format. Please try again.`
        )
      );
      return;
    }

    storeCallbackMessageId(ctx, "timetableMessageId");

    const timetable = findItemById(ctx.session.timetableTimetables, parsed.id);
    const attachment = getTimetableAttachment(timetable);

    // The successful render replaces the selection buttons, so a repeated
    // selection callback is a duplicate tap rather than a new choice.
    const selectionChanged = await editMessageIgnoringNotModified(() =>
      renderSelection(ctx, timetable, attachment)
    );
    if (!selectionChanged) {
      logger.debug(
        { chatId: ctx.chat?.id, userId: ctx.from?.id },
        "Ignoring duplicate timetable selection"
      );
      return;
    }
    if (!attachment) return;
    await queueTimetableDownload(ctx, attachment);
  }

  async function viewAnother(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();

    ctx.session.timetablePage = LOOKUP_CONFIG.INITIAL_PAGE;
    await fetchAndDisplay(ctx);
  }

  async function end(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();

    await editMessageIgnoringNotModified(() =>
      ctx.editMessageText(
        `Timetable lookup ended. Use /${timetableCommandInfo.name} to start again.`
      )
    );

    ctx.session.timetablePage = null;
    ctx.session.timetableTimetables = [];
    ctx.session.timetableMessageId = null;
  }

  async function previousPage(ctx: CallbackContext): Promise<void> {
    await handleApiPreviousPage(ctx, createLookupConfig());
  }

  async function nextPage(ctx: CallbackContext): Promise<void> {
    await handleApiNextPage(ctx, createLookupConfig());
  }

  return { start, select, viewAnother, end, previousPage, nextPage };
}
