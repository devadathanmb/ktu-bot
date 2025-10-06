import { BotContext } from "../../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer, InlineKeyboard } from "grammy";
import { createGrammyInputFileFromAttachment } from "../../../../utils/fileUtils.js";
import { ExamTimeTable } from "../../../../types/service.types.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
  PaginatedItem,
} from "../helpers.js";
import { FormattedString, fmt, b } from "@grammyjs/parse-mode";
import { SessionNotFoundError } from "../../../../errors/index.js";
import {
  combineFormattedDouble,
  combineFormattedSingle,
  formatCommand,
} from "../../../../utils/formatting.js";
import { createTimetableErrorBoundary } from "../../shared/errorBoundary.js";
import { deleteMessageSafely } from "../../../../utils/bot.js";
import { emoji } from "@grammyjs/emoji";
import { fetchTimetables } from "../../../../api/services/index.js";

const MESSAGES: Record<string, FormattedString[]> = {
  FETCHING_TIMETABLES: [
    fmt`${emoji("hourglass_not_done")} Fetching timetables... Please wait...`,
  ],
  FETCHING_DETAILS: [
    fmt`${emoji("hourglass_not_done")} Fetching timetable details... Please wait...`,
  ],
  NO_MORE_TIMETABLES: [fmt`${emoji("cross_mark")} No more timetables found.`],
  INVALID_CALLBACK: [
    fmt`${emoji("cross_mark")} Invalid callback format. Please try again.`,
  ],
} as const;

function generateTimetablesKeyboard(
  timetables: ExamTimeTable[],
  currentPage: number
): InlineKeyboard {
  const paginatedItems: PaginatedItem[] = timetables.map(timetable => ({
    id: timetable.id,
    subject: timetable.title,
    formattedPublishedDate: timetable.formattedPublishedDate,
  }));
  return generatePaginatedKeyboard(paginatedItems, currentPage, "timetable", 5);
}

function generateTimetablesText(timetables: ExamTimeTable[]): FormattedString {
  const paginatedItems: PaginatedItem[] = timetables.map(timetable => ({
    id: timetable.id,
    subject: timetable.title,
    formattedPublishedDate: timetable.formattedPublishedDate,
  }));
  return generatePaginatedMessageText(
    paginatedItems,
    `${emoji("books")} Exam Timetables`,
    "timetable"
  );
}

const composer = new Composer<BotContext>();

// Create protected composer with error boundary for loading message cleanup
const protectedComposer = composer.errorBoundary(
  createTimetableErrorBoundary()
);

const timetableLookupCommand = new Command<BotContext>(
  "timetables",
  `${emoji("books")} Find published exam timetables from KTU`,
  async (ctx: BotContext) => {
    // Initialize session data
    if (ctx.session.timetablePage === null) {
      ctx.session.timetablePage = 0;
    }

    const formattedMsg = combineFormattedDouble(
      MESSAGES["FETCHING_TIMETABLES"]!
    );
    const loadingMessage = await ctx.reply(formattedMsg.text, {
      entities: formattedMsg.entities,
    });

    // Store the loading message ID in session for error boundary cleanup
    ctx.session.timetableMessageId = loadingMessage.message_id;

    const timetables = await fetchTimetables({
      pageNumber: ctx.session.timetablePage,
      dataSize: 10,
    });

    const keyboard = generateTimetablesKeyboard(
      timetables,
      ctx.session.timetablePage
    );

    const messageText = generateTimetablesText(timetables);

    // Store data in session
    ctx.session.timetableTimetables = timetables;

    // Edit the loading message with the actual content
    await ctx.api.editMessageText(
      ctx.chat!.id,
      loadingMessage.message_id,
      messageText.text,
      {
        reply_markup: keyboard,
        entities: messageText.entities,
      }
    );

    // Store message ID for future edits
    ctx.session.timetableMessageId = loadingMessage.message_id;
  }
);

// Callback query handler for selecting timetables
// Callback query handlers - use protected composer for error boundary coverage
protectedComposer.callbackQuery(/^timetable_select_/, async ctx => {
  await ctx.answerCallbackQuery();

  const callbackData = ctx.callbackQuery.data;
  if (!callbackData) {
    const formattedMsg = combineFormattedDouble(MESSAGES["INVALID_CALLBACK"]!);
    await ctx.editMessageText(formattedMsg.text, {
      entities: formattedMsg.entities,
    });
    return;
  }

  const callbackParts = callbackData.split("_");
  if (callbackParts.length < 3 || !callbackParts[2]) {
    const formattedMsg = combineFormattedDouble(MESSAGES["INVALID_CALLBACK"]!);
    await ctx.editMessageText(formattedMsg.text, {
      entities: formattedMsg.entities,
    });
    return;
  }

  const timetableId = parseInt(callbackParts[2]);

  if (!timetableId || ctx.session.timetableTimetables.length === 0)
    throw new SessionNotFoundError();

  const selectedTimetable = ctx.session.timetableTimetables.find(
    timetable => timetable.id === timetableId
  )!;

  let formattedMsg = combineFormattedDouble(MESSAGES["FETCHING_DETAILS"]!);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });

  // Prepare the timetable details message
  const parts: FormattedString[] = [];
  if (selectedTimetable.title) {
    parts.push(
      combineFormattedSingle([
        fmt`${emoji("glowing_star")} ${b}Title:${b}`,
        fmt`${selectedTimetable.title}`,
      ])
    );
  }

  if (selectedTimetable.formattedPublishedDate) {
    parts.push(
      combineFormattedSingle([
        fmt`${emoji("calendar")} ${b}Date:${b} ${selectedTimetable.formattedPublishedDate}`,
      ])
    );
  }

  // Combine all parts into a single message
  const captionMsg = combineFormattedDouble(parts);

  // Check if timetable has attachment
  if (!selectedTimetable.attachmentId) {
    const noAttachmentMsg = combineFormattedDouble([
      captionMsg,
      fmt`${emoji("woman_shrugging")} No attachment found for this timetable.`,
    ]);

    // Create "View Another" keyboard
    const keyboard = new InlineKeyboard()
      .text(`${emoji("check_mark_button")} Yes`, "timetable_view_another_true")
      .text(`${emoji("cross_mark")} No`, "timetable_view_another_false");

    await ctx.editMessageText(noAttachmentMsg.text, {
      reply_markup: keyboard,
      entities: noAttachmentMsg.entities,
    });
    return;
  }

  // Send the timetable details first
  await ctx.editMessageText(captionMsg.text, {
    entities: captionMsg.entities,
  });

  // Show loading message for attachment fetching
  if (
    selectedTimetable.fileName != null &&
    selectedTimetable.encryptId != null
  ) {
    formattedMsg = combineFormattedDouble([
      fmt`${emoji("hourglass_not_done")} Fetching attachment ${selectedTimetable.fileName}... Please wait...`,
    ]);
    const loadingMessage = await ctx.reply(formattedMsg.text, {
      entities: formattedMsg.entities,
    });

    // Fetch and send the timetable attachment
    const inputFile = await createGrammyInputFileFromAttachment(
      selectedTimetable.encryptId,
      selectedTimetable.fileName
    );

    await ctx.replyWithDocument(inputFile, {
      caption: `${emoji("books")} Timetable: ${selectedTimetable.title}`,
      reply_parameters: {
        message_id: ctx.msgId!,
        allow_sending_without_reply: true,
      },
    });

    // Delete the loading message
    await deleteMessageSafely(ctx, loadingMessage.message_id);
  }

  // Create "View Another" keyboard
  const keyboard = new InlineKeyboard()
    .text(`${emoji("check_mark_button")} Yes`, "timetable_view_another_true")
    .text(`${emoji("cross_mark")} No`, "timetable_view_another_false");

  await ctx.reply(`${emoji("eyes")} View another timetable?`, {
    reply_markup: keyboard,
  });
});

// Handler for "View Another" - Yes
protectedComposer.callbackQuery("timetable_view_another_true", async ctx => {
  await ctx.answerCallbackQuery();

  // Reset to page 0 and show timetables again
  ctx.session.timetablePage = 0;

  // Store the message ID for error boundary cleanup
  ctx.session.timetableMessageId = ctx.callbackQuery.message!.message_id;

  const formattedMsg = combineFormattedDouble(MESSAGES["FETCHING_TIMETABLES"]!);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });

  const timetables = await fetchTimetables({
    pageNumber: ctx.session.timetablePage,
    dataSize: 10,
  });

  const keyboard = generateTimetablesKeyboard(
    timetables,
    ctx.session.timetablePage
  );

  const messageText = generateTimetablesText(timetables);
  ctx.session.timetableTimetables = timetables;

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
});

// Handler for "View Another" - No
protectedComposer.callbackQuery("timetable_view_another_false", async ctx => {
  await ctx.answerCallbackQuery();

  await ctx.editMessageText(
    `Timetable lookup ended. Use ${formatCommand(timetableLookupCommand)} to start again.`
  );

  // Clear session data
  ctx.session.timetablePage = null;
  ctx.session.timetableTimetables = [];
  ctx.session.timetableMessageId = null;
});

// Callback query handlers for navigation
protectedComposer.callbackQuery("timetable_page_info", async ctx => {
  await ctx.answerCallbackQuery();
});

protectedComposer.callbackQuery("timetable_prev_page", async ctx => {
  await ctx.answerCallbackQuery();

  if (ctx.session.timetablePage === null || ctx.session.timetablePage === 0) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  ctx.session.timetablePage--;

  // Store the message ID for error boundary cleanup
  ctx.session.timetableMessageId = ctx.callbackQuery.message!.message_id;

  const formattedMsg = combineFormattedDouble(MESSAGES["FETCHING_TIMETABLES"]!);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });

  const timetables = await fetchTimetables({
    pageNumber: ctx.session.timetablePage,
    dataSize: 10,
  });

  const keyboard = generateTimetablesKeyboard(
    timetables,
    ctx.session.timetablePage
  );

  const messageText = generateTimetablesText(timetables);
  ctx.session.timetableTimetables = timetables;

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
});

protectedComposer.callbackQuery("timetable_next_page", async ctx => {
  await ctx.answerCallbackQuery();

  if (ctx.session.timetablePage === null) {
    ctx.session.timetablePage = 0;
  }

  ctx.session.timetablePage++;

  // Store the message ID for error boundary cleanup
  ctx.session.timetableMessageId = ctx.callbackQuery.message!.message_id;

  const formattedMsg = combineFormattedDouble(MESSAGES["FETCHING_TIMETABLES"]!);
  await ctx.editMessageText(formattedMsg.text, {
    entities: formattedMsg.entities,
  });

  const timetables = await fetchTimetables({
    pageNumber: ctx.session.timetablePage,
    dataSize: 10,
  });

  // If no timetables found, revert page number
  if (timetables.length === 0) {
    ctx.session.timetablePage--;
    const formattedMsg = combineFormattedDouble(
      MESSAGES["NO_MORE_TIMETABLES"]!
    );
    await ctx.editMessageText(formattedMsg.text, {
      entities: formattedMsg.entities,
    });
    return;
  }

  const keyboard = generateTimetablesKeyboard(
    timetables,
    ctx.session.timetablePage
  );

  const messageText = generateTimetablesText(timetables);
  ctx.session.timetableTimetables = timetables;

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
});

// Create the timetable command group
const timetableCommands = new CommandGroup<BotContext>();

// Add commands to the group
timetableCommands.add(timetableLookupCommand);

// Hook the command group into the protected composer (with error boundary)
protectedComposer.use(timetableCommands);

export const timetableLookup = composer;
export { timetableCommands, timetableLookupCommand };
