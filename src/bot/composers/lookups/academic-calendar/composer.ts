import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer, InlineKeyboard } from "grammy";
import { fetchAcademicCalendars } from "../../../../api/services/index.js";
import { AcademicCalendar } from "../../../../types/service.types.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
  PaginatedItem,
  parseSelectCallback,
  createViewAnotherKeyboard,
  findItemById,
  storeCallbackMessageId,
} from "../utils.js";
import { LOOKUP_CONFIG } from "../constants.js";
import { FormattedString, fmt, b } from "@grammyjs/parse-mode";
import {
  formatCommand,
  joinWithNewlines,
} from "../../../../utils/formatting.js";
import { createCalendarErrorBoundary } from "../../shared/error-boundary.js";
import { emoji } from "@grammyjs/emoji";
import { addAttachmentDeliveryJob } from "../../../../workers/attachment-delivery/queue.js";

const MESSAGES = {
  FETCHING_CALENDARS: [
    fmt`${emoji("hourglass_not_done")} Fetching academic calendars... Please wait...`,
  ],
  FETCHING_DETAILS: [
    fmt`${emoji("hourglass_not_done")} Fetching calendar details... Please wait...`,
  ],
};

function generateCalendarsKeyboard(
  calendars: AcademicCalendar[],
  currentPage: number
): InlineKeyboard {
  const paginatedItems: PaginatedItem[] = calendars.map(calendar => ({
    id: calendar.id,
    subject: calendar.title,
    formattedPublishedDate: calendar.formattedPublishedDate,
  }));
  return generatePaginatedKeyboard(paginatedItems, currentPage, "calendar", 5);
}

function generateCalendarsText(calendars: AcademicCalendar[]): FormattedString {
  const paginatedItems: PaginatedItem[] = calendars.map(calendar => ({
    id: calendar.id,
    subject: calendar.title,
    formattedPublishedDate: calendar.formattedPublishedDate,
  }));
  return generatePaginatedMessageText(
    paginatedItems,
    `${emoji("graduation_cap")} Academic Calendars`,
    "calendar"
  );
}

function formatCalendarDetails(calendar: AcademicCalendar): FormattedString {
  return joinWithNewlines(
    [
      fmt`${emoji("glowing_star")} ${b}Title:${b} ${calendar.title}`,
      fmt`${emoji("calendar")} ${b}Date:${b} ${calendar.formattedPublishedDate}`,
    ],
    2
  );
}

async function handleCalendarSelection(
  ctx: BotContext,
  calendar: AcademicCalendar
): Promise<void> {
  const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_DETAILS, 2);
  await ctx.editMessageText(loadingMsg.text, {
    entities: loadingMsg.entities,
  });

  const detailsMsg = formatCalendarDetails(calendar);
  await ctx.editMessageText(detailsMsg.text, {
    entities: detailsMsg.entities,
  });
}

async function handleCalendarAttachment(
  ctx: BotContext,
  calendar: AcademicCalendar
): Promise<void> {
  const keyboard = createViewAnotherKeyboard("calendar");

  if (!calendar.attachmentId) {
    const noAttachmentMsg = joinWithNewlines(
      [
        formatCalendarDetails(calendar),
        fmt`${emoji("woman_shrugging")} No attachment found for this academic calendar.`,
      ],
      2
    );

    await ctx.editMessageText(noAttachmentMsg.text, {
      reply_markup: keyboard,
      entities: noAttachmentMsg.entities,
    });
    return;
  }

  const statusMessage = await ctx.reply(
    `${emoji("hourglass_not_done")} Downloading your calendar in the background... This may take a moment!`
  );

  const jobData: Parameters<typeof addAttachmentDeliveryJob>[0] = {
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

  await addAttachmentDeliveryJob(jobData);
}

async function fetchAndDisplayCalendars(ctx: BotContext): Promise<void> {
  storeCallbackMessageId(ctx, "calendarMessageId");

  const loadingMsg = joinWithNewlines(MESSAGES.FETCHING_CALENDARS, 2);
  await ctx.editMessageText(loadingMsg.text, {
    entities: loadingMsg.entities,
  });

  const calendars = await fetchAcademicCalendars({
    pageNumber: ctx.session.calendarPage ?? LOOKUP_CONFIG.INITIAL_PAGE,
    dataSize: LOOKUP_CONFIG.PAGE_SIZE,
  });

  ctx.session.calendarCalendars = calendars;
  const keyboard = generateCalendarsKeyboard(
    calendars,
    ctx.session.calendarPage ?? LOOKUP_CONFIG.INITIAL_PAGE
  );
  const messageText = generateCalendarsText(calendars);

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
}

const composer = new Composer<BotContext>();
const protectedComposer = composer.errorBoundary(createCalendarErrorBoundary());

const calendarLookupCommand = new Command<BotContext>(
  "calendars",
  `${emoji("calendar")} Find published academic calendars from KTU`,
  async (ctx: BotContext) => {
    if (ctx.session.calendarPage === null) {
      ctx.session.calendarPage = LOOKUP_CONFIG.INITIAL_PAGE;
    }

    const formattedMsg = joinWithNewlines(MESSAGES.FETCHING_CALENDARS, 2);
    const loadingMessage = await ctx.reply(formattedMsg.text, {
      entities: formattedMsg.entities,
    });

    ctx.session.calendarMessageId = loadingMessage.message_id;

    const calendars = await fetchAcademicCalendars({
      pageNumber: ctx.session.calendarPage,
      dataSize: LOOKUP_CONFIG.PAGE_SIZE,
    });
    const keyboard = generateCalendarsKeyboard(
      calendars,
      ctx.session.calendarPage
    );
    const messageText = generateCalendarsText(calendars);

    ctx.session.calendarCalendars = calendars;

    await ctx.api.editMessageText(
      ctx.chat!.id,
      loadingMessage.message_id,
      messageText.text,
      {
        reply_markup: keyboard,
        entities: messageText.entities,
      }
    );
  }
);

protectedComposer.callbackQuery(/^calendar_select_/, async ctx => {
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

  await handleCalendarSelection(ctx, calendar);
  await handleCalendarAttachment(ctx, calendar);
});

protectedComposer.callbackQuery("calendar_view_another_true", async ctx => {
  await ctx.answerCallbackQuery();

  // Reset to first page and refetch
  ctx.session.calendarPage = LOOKUP_CONFIG.INITIAL_PAGE;
  await fetchAndDisplayCalendars(ctx);
});

protectedComposer.callbackQuery("calendar_view_another_false", async ctx => {
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    `Academic calendar lookup ended. Use ${formatCommand(calendarLookupCommand)} to start again.`
  );

  ctx.session.calendarPage = null;
  ctx.session.calendarCalendars = [];
  ctx.session.calendarMessageId = null;
});

protectedComposer.callbackQuery("calendar_page_info", async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery("calendar_prev_page", async ctx => {
  await ctx.answerCallbackQuery();

  const currentPage = ctx.session.calendarPage ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (currentPage === LOOKUP_CONFIG.INITIAL_PAGE) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  ctx.session.calendarPage = currentPage - 1;
  await fetchAndDisplayCalendars(ctx);
});

protectedComposer.callbackQuery("calendar_next_page", async ctx => {
  const currentPage = ctx.session.calendarPage ?? LOOKUP_CONFIG.INITIAL_PAGE;

  // If current page returned fewer items than PAGE_SIZE, we're on the last page
  if (ctx.session.calendarCalendars.length < LOOKUP_CONFIG.PAGE_SIZE) {
    await ctx.answerCallbackQuery("You are already on the last page.");
    return;
  }

  const nextPage = currentPage + 1;
  const calendars = await fetchAcademicCalendars({
    pageNumber: nextPage,
    dataSize: LOOKUP_CONFIG.PAGE_SIZE,
  });

  if (calendars.length === 0) {
    await ctx.answerCallbackQuery("You are already on the last page.");
    return;
  }

  await ctx.answerCallbackQuery();
  storeCallbackMessageId(ctx, "calendarMessageId");
  ctx.session.calendarPage = nextPage;
  ctx.session.calendarCalendars = calendars;

  const keyboard = generateCalendarsKeyboard(calendars, nextPage);
  const messageText = generateCalendarsText(calendars);

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
});

const calendarCommands = new CommandGroup<BotContext>();

calendarCommands.add(calendarLookupCommand);

protectedComposer.use(calendarCommands);

export const calendarLookup = composer;
export { calendarCommands, calendarLookupCommand };
