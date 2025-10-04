import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer, InlineKeyboard } from "grammy";
import ensureChatId from "../../../middlewares/ensureChatId.js";
import { fetchAcademicCalendars } from "../../../../api/services/index.js";
import { createGrammyInputFileFromAttachment } from "../../../../utils/fileUtils.js";
import { AcademicCalendar } from "../../../../types/service.types.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
  PaginatedItem,
} from "../helpers.js";
import { FormattedString, fmt, b } from "@grammyjs/parse-mode";
import { ChatNotFoundError } from "../../../../errors/index.js";
import { combineFormattedDouble } from "../../../../utils/combineFormatted.js";
import { createCalendarErrorBoundary } from "../../shared/errorBoundary.js";
import { deleteMessageSafely } from "../../../../utils/safeDelete.js";
import { emoji } from "@grammyjs/emoji";

// Common messages used throughout the composer
const MESSAGES: Record<string, FormattedString[]> = {
  FETCHING_CALENDARS: [
    fmt`${emoji("hourglass_not_done")} Fetching academic calendars... Please wait...`,
  ],
  FETCHING_DETAILS: [
    fmt`${emoji("hourglass_not_done")} Fetching calendar details... Please wait...`,
  ],
  FETCHING_ATTACHMENT: [
    fmt`${emoji("hourglass_not_done")} Fetching calendar attachment... Please wait...`,
  ],
  NO_MORE_CALENDARS: [fmt`${emoji("cross_mark")} No more calendars found.`],
  INVALID_CALLBACK: [
    fmt`${emoji("cross_mark")} Invalid callback format. Please try again.`,
  ],
} as const;

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

// Create the composer with error boundary
const composer = new Composer<BotContext>();
composer.use(ensureChatId);
const protectedComposer = composer.errorBoundary(createCalendarErrorBoundary());

// Command: /calendar - Start academic calendar lookup
const calendarLookupCommand = new Command<BotContext>(
  "calendar",
  "📅 Find published academic calendars from KTU",
  async (ctx: BotContext) => {
    // Initialize session data
    if (ctx.session.calendarPage === null) {
      ctx.session.calendarPage = 0;
    }

    // Send a loading message
    const formattedMsg = combineFormattedDouble(
      MESSAGES["FETCHING_CALENDARS"]!!
    );
    const loadingMessage = await ctx.reply(formattedMsg.text, {
      entities: formattedMsg.entities,
    });

    // Store message ID immediately for error boundary cleanup
    ctx.session.calendarMessageId = loadingMessage.message_id;

    // Fetch the calendars, prepare and display
    const calendars = await fetchAcademicCalendars({
      pageNumber: ctx.session.calendarPage,
      dataSize: 10,
    });
    const keyboard = generateCalendarsKeyboard(
      calendars,
      ctx.session.calendarPage
    );
    const messageText = generateCalendarsText(calendars);

    // Store data in session for callback updates
    ctx.session.calendarCalendars = calendars;

    // Edit the loading message with the actual content
    await loadingMessage.editText(messageText.text, {
      reply_markup: keyboard,
      entities: messageText.entities,
    });
  }
);

// Callback query handler for selecting calendars
protectedComposer.callbackQuery(/^calendar_select_/, async ctx => {
  await ctx.answerCallbackQuery();
  const callbackData = ctx.callbackQuery.data;

  // Store current message ID for error boundary cleanup
  if (ctx.callbackQuery.message?.message_id) {
    ctx.session.calendarMessageId = ctx.callbackQuery.message.message_id;
  }

  // Grab the calendar ID from the callback data
  const callbackParts = callbackData.split("_");
  if (callbackParts.length < 3 || !callbackParts[2]) {
    const formattedMsg = combineFormattedDouble(MESSAGES["INVALID_CALLBACK"]!!);
    await ctx.editMessageText(formattedMsg.text, {
      entities: formattedMsg.entities,
    });
    return;
  }
  const calendarId = parseInt(callbackParts[2]);
  if (!calendarId || ctx.session.calendarCalendars.length === 0)
    throw new ChatNotFoundError();

  // Find the selected calendar from session data
  const selectedCalendar = ctx.session.calendarCalendars.find(
    calendar => calendar.id === calendarId
  )!;

  // Prepare the calendar details message
  const formattedMsg = combineFormattedDouble(MESSAGES["FETCHING_DETAILS"]!!);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });
  const captionMsg = combineFormattedDouble([
    fmt`${emoji("glowing_star")} ${b}Title:${b} ${selectedCalendar.title}`,
    fmt`${emoji("calendar")} ${b}Date:${b} ${selectedCalendar.formattedPublishedDate}`,
  ]);

  // Check if calendar has attachment
  if (!selectedCalendar.attachmentId) {
    const noAttachmentMsg = combineFormattedDouble([
      captionMsg,
      fmt`${emoji("woman_shrugging")} No attachment found for this academic calendar.`,
    ]);

    // Create "View Another" keyboard
    const keyboard = new InlineKeyboard()
      .text(`${emoji("check_mark_button")} Yes`, "calendar_view_another_true")
      .text(`${emoji("cross_mark")} No`, "calendar_view_another_false");

    await ctx.editMessageText(noAttachmentMsg.text, {
      reply_markup: keyboard,
      entities: noAttachmentMsg.entities,
    });
    return;
  }

  // Send the calendar details first
  await ctx.editMessageText(captionMsg.text, {
    entities: captionMsg.entities,
  });

  // Show loading message for attachment fetching
  const formattedMsgAttachment = combineFormattedDouble(
    MESSAGES["FETCHING_ATTACHMENT"]!
  );
  const loadingMessage = await ctx.reply(formattedMsgAttachment.text, {
    entities: formattedMsgAttachment.entities,
  });

  // Fetch and send the calendar attachment
  const inputFile = await createGrammyInputFileFromAttachment(
    selectedCalendar.encryptId,
    selectedCalendar.attachmentName
  );
  await ctx.replyWithDocument(inputFile, {
    caption: `${emoji("calendar")} Academic Calendar: ${selectedCalendar.title}`,
    reply_parameters: {
      message_id: ctx.msgId!,
      allow_sending_without_reply: true,
    },
  });

  // Delete the loading message
  await deleteMessageSafely(ctx, loadingMessage.message_id);

  // Create "View Another" keyboard
  const keyboard = new InlineKeyboard()
    .text(`${emoji("check_mark_button")} Yes`, "calendar_view_another_true")
    .text(`${emoji("cross_mark")} No`, "calendar_view_another_false");

  await ctx.reply(`${emoji("eyes")} View another calendar?`, {
    reply_markup: keyboard,
  });
});

// Handler for "View Another" - Yes
protectedComposer.callbackQuery("calendar_view_another_true", async ctx => {
  await ctx.answerCallbackQuery();

  // Store current message ID for error boundary cleanup
  if (ctx.callbackQuery.message?.message_id) {
    ctx.session.calendarMessageId = ctx.callbackQuery.message.message_id;
  }

  // Reset to page 0 and show calendars again
  ctx.session.calendarPage = 0;

  // Start fetching and displaying calendars again
  const formattedMsg = combineFormattedDouble(MESSAGES["FETCHING_CALENDARS"]!);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });
  const calendars = await fetchAcademicCalendars({
    pageNumber: ctx.session.calendarPage,
    dataSize: 10,
  });
  const keyboard = generateCalendarsKeyboard(
    calendars,
    ctx.session.calendarPage
  );

  // Generate the message, update session and edit message again with new data
  const messageText = generateCalendarsText(calendars);
  ctx.session.calendarCalendars = calendars;
  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
});

// Handler for "View Another" - No
protectedComposer.callbackQuery("calendar_view_another_false", async ctx => {
  // Anwer callback and edit message
  await ctx.answerCallbackQuery();
  await ctx.editMessageText(
    "Academic calendar lookup ended. Use /calendar to start again."
  );

  // Clear session data
  ctx.session.calendarPage = null;
  ctx.session.calendarCalendars = [];
  ctx.session.calendarMessageId = null;
});

// Callback query handlers for navigation
protectedComposer.callbackQuery("calendar_page_info", async ctx => {
  await ctx.answerCallbackQuery();
});

// Callback query handler for "Previous Page"
protectedComposer.callbackQuery("calendar_prev_page", async ctx => {
  await ctx.answerCallbackQuery();

  // Store current message ID for error boundary cleanup
  if (ctx.callbackQuery.message?.message_id) {
    ctx.session.calendarMessageId = ctx.callbackQuery.message.message_id;
  }

  if (ctx.session.calendarPage === null || ctx.session.calendarPage === 0) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  ctx.session.calendarPage--;

  // Fetch and display previous page
  const formattedMsg = combineFormattedDouble(MESSAGES["FETCHING_CALENDARS"]!);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });
  const calendars = await fetchAcademicCalendars({
    pageNumber: ctx.session.calendarPage,
    dataSize: 10,
  });
  const keyboard = generateCalendarsKeyboard(
    calendars,
    ctx.session.calendarPage
  );

  // Generate the message, update session and edit message again with new data
  const messageText = generateCalendarsText(calendars);
  ctx.session.calendarCalendars = calendars;
  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
});

// Callback query handler for "Next Page"
protectedComposer.callbackQuery("calendar_next_page", async ctx => {
  await ctx.answerCallbackQuery();

  // Store current message ID for error boundary cleanup
  if (ctx.callbackQuery.message?.message_id) {
    ctx.session.calendarMessageId = ctx.callbackQuery.message.message_id;
  }

  if (ctx.session.calendarPage === null) {
    ctx.session.calendarPage = 0;
  }
  ctx.session.calendarPage++;

  // Fetch and display next page
  const formattedMsg = combineFormattedDouble(MESSAGES["FETCHING_CALENDARS"]!);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });
  const calendars = await fetchAcademicCalendars({
    pageNumber: ctx.session.calendarPage,
    dataSize: 10,
  });

  // If no calendars found, revert page number
  if (calendars.length === 0) {
    ctx.session.calendarPage--;
    const formattedMsg = combineFormattedDouble(MESSAGES["NO_MORE_CALENDARS"]!);
    await ctx.editMessageText(formattedMsg.text, {
      entities: formattedMsg.entities,
    });
    return;
  }

  // Prepare and display the next page, update session
  const keyboard = generateCalendarsKeyboard(
    calendars,
    ctx.session.calendarPage
  );
  const messageText = generateCalendarsText(calendars);
  ctx.session.calendarCalendars = calendars;
  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
});

// Create the calendar command group
const calendarCommands = new CommandGroup<BotContext>();

// Add commands to the group
calendarCommands.add(calendarLookupCommand);

// Hook the command group into the composer
protectedComposer.use(calendarCommands);

export const calendarLookup = composer;
export { calendarCommands };
