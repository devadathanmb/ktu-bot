import { emoji } from "@grammyjs/emoji";
import { fmt } from "@grammyjs/parse-mode";
import { CallbackQueryContext } from "grammy";
import { BotContext } from "../../../../types/bot.types.js";
import { AcademicCalendar } from "../../../../types/service.types.js";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import type { AttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";
import { calendarCommandInfo } from "../command-info.js";
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
import {
  formatCalendarDetails,
  generateCalendarsKeyboard,
  generateCalendarsText,
} from "./views.js";

const MESSAGES = {
  FETCHING_CALENDARS: [
    fmt`${emoji("hourglass_not_done")} Fetching academic calendars... Please wait...`,
  ],
};

type CallbackContext = CallbackQueryContext<BotContext>;

// Every dependency is required: the composer wires the live KTU fetcher and
// the attachment-delivery queue exactly once, and the flow closes over them.
export interface CalendarFlowDeps {
  fetchCalendars: (params: {
    pageNumber: number;
    dataSize: number;
  }) => Promise<AcademicCalendar[]>;
  queueDownload: (job: AttachmentDeliveryJob) => Promise<unknown>;
}

export interface CalendarFlow {
  start(ctx: BotContext): Promise<void>;
  select(ctx: CallbackContext): Promise<void>;
  viewAnother(ctx: CallbackContext): Promise<void>;
  end(ctx: CallbackContext): Promise<void>;
  previousPage(ctx: CallbackContext): Promise<void>;
  nextPage(ctx: CallbackContext): Promise<void>;
}

export function createCalendarFlow(deps: CalendarFlowDeps): CalendarFlow {
  function createLookupConfig() {
    return {
      messageIdSessionKey: "calendarMessageId" as const,
      getPage: (ctx: BotContext) => ctx.session.calendarPage,
      setPage: (ctx: BotContext, page: number | null) => {
        ctx.session.calendarPage = page;
      },
      getItems: (ctx: BotContext) => ctx.session.calendarCalendars,
      setItems: (ctx: BotContext, calendars: AcademicCalendar[]) => {
        ctx.session.calendarCalendars = calendars;
      },
      fetchPage: (pageNumber: number) =>
        deps.fetchCalendars({
          pageNumber,
          dataSize: LOOKUP_CONFIG.PAGE_SIZE,
        }),
      buildKeyboard: generateCalendarsKeyboard,
      buildText: generateCalendarsText,
      loadingMessage: joinWithNewlines(MESSAGES.FETCHING_CALENDARS, 2),
    };
  }

  async function fetchAndDisplay(ctx: BotContext): Promise<void> {
    await fetchAndRenderApiPage(ctx, createLookupConfig());
  }

  async function handleSelection(
    ctx: BotContext,
    calendar: AcademicCalendar
  ): Promise<void> {
    const detailsMsg = formatCalendarDetails(calendar);
    await ctx.editMessageText(detailsMsg.text, {
      entities: detailsMsg.entities,
    });
  }

  async function handleAttachment(
    ctx: BotContext,
    calendar: AcademicCalendar
  ): Promise<void> {
    const statusMessage = await ctx.reply(
      `${emoji("hourglass_not_done")} Downloading your calendar in the background... This may take a moment!`
    );

    const jobData: AttachmentDeliveryJob = {
      chatId: ctx.chat!.id,
      attachments: [
        {
          name: calendar.attachmentName,
          encryptId: calendar.encryptId,
        },
      ],
      statusMessageId: statusMessage.message_id,
      context: "calendar",
      sendViewAnotherMessage: true,
    };

    if (ctx.msgId !== undefined) {
      jobData.replyToMessageId = ctx.msgId;
    }

    await deps.queueDownload(jobData);
  }

  async function start(ctx: BotContext): Promise<void> {
    if (ctx.session.calendarPage === null) {
      ctx.session.calendarPage = LOOKUP_CONFIG.INITIAL_PAGE;
    }

    const formattedMsg = joinWithNewlines(MESSAGES.FETCHING_CALENDARS, 2);
    const loadingMessage = await ctx.reply(formattedMsg.text, {
      entities: formattedMsg.entities,
    });
    ctx.session.calendarMessageId = loadingMessage.message_id;

    await startApiPaginatedLookup(
      ctx,
      createLookupConfig(),
      loadingMessage.message_id
    );
  }

  async function select(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();

    const parsed = parseSelectCallback(ctx.callbackQuery.data, "calendar");
    if (!parsed.isValid) {
      await ctx.editMessageText(
        `${emoji("cross_mark")} Invalid callback format. Please try again.`
      );
      return;
    }

    storeCallbackMessageId(ctx, "calendarMessageId");

    const calendar = findItemById(ctx.session.calendarCalendars, parsed.id);

    await handleSelection(ctx, calendar);
    await handleAttachment(ctx, calendar);
  }

  async function viewAnother(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();

    ctx.session.calendarPage = LOOKUP_CONFIG.INITIAL_PAGE;
    await fetchAndDisplay(ctx);
  }

  async function end(ctx: CallbackContext): Promise<void> {
    await ctx.answerCallbackQuery();
    await ctx.editMessageText(
      `Academic calendar lookup ended. Use /${calendarCommandInfo.name} to start again.`
    );

    ctx.session.calendarPage = null;
    ctx.session.calendarCalendars = [];
    ctx.session.calendarMessageId = null;
  }

  async function previousPage(ctx: CallbackContext): Promise<void> {
    await handleApiPreviousPage(ctx, createLookupConfig());
  }

  async function nextPage(ctx: CallbackContext): Promise<void> {
    await handleApiNextPage(ctx, createLookupConfig());
  }

  return { start, select, viewAnother, end, previousPage, nextPage };
}
