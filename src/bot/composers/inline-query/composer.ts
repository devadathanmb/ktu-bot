import { BotContext } from "../../../types/bot.types.js";
import { Composer } from "grammy";
import { createComposerErrorBoundary } from "../shared/error-boundary.js";
import { fmt } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import logger from "../../../utils/logger.js";
import type { InlineQueryResult } from "grammy/types";
import { addAttachmentDeliveryJob } from "../../../workers/attachment-delivery/queue.js";
import { AcademicCalendarsRepository } from "../../../db/repositories/academic-calendars-repository.js";
import { AnnouncementsRepository } from "../../../db/repositories/announcements-repository.js";
import { ExamTimetablesRepository } from "../../../db/repositories/exam-timetables-repository.js";
import { parseQuery } from "./query.js";
import {
  addSearchAgainButton,
  buildHelpResults,
  buildTemporarySearchFailureResult,
} from "./results.js";
import {
  searchAnnouncements,
  searchCalendars,
  searchTimetables,
} from "./search.js";
import {
  buildAttachmentDeliveryJob,
  resolveChosenResultAttachments,
} from "./chosen-result.js";
import { SearchType } from "./search-types.js";

const _inlineQuery = new Composer<BotContext>();

export const inlineQuery = _inlineQuery.errorBoundary(
  createComposerErrorBoundary([])
);

inlineQuery.on("inline_query", async ctx => {
  const query = ctx.inlineQuery?.query || "";
  const { type, searchTerm } = parseQuery(query);
  const chatId = ctx.from?.id;

  let results: InlineQueryResult[] = [];

  try {
    if (!type) {
      results = buildHelpResults();
    } else {
      switch (type) {
        case SearchType.ANNOUNCEMENTS:
          results = await searchAnnouncements(
            searchTerm,
            new AnnouncementsRepository()
          );
          break;
        case SearchType.CALENDARS:
          results = await searchCalendars(
            searchTerm,
            new AcademicCalendarsRepository()
          );
          break;
        case SearchType.TIMETABLES:
          results = await searchTimetables(
            searchTerm,
            new ExamTimetablesRepository()
          );
          break;
      }

      results = addSearchAgainButton(results, query);
    }
  } catch (error) {
    logger.error(
      { err: error, chatId, query, type, searchTerm },
      "Error in inline query handler"
    );

    results = buildTemporarySearchFailureResult();
  }

  try {
    await ctx.answerInlineQuery(results);
  } catch (error) {
    logger.error(
      { err: error, chatId, query, type, searchTerm },
      "Failed to answer inline query"
    );
  }
});

inlineQuery.on("chosen_inline_result", async ctx => {
  const chosenResult = ctx.chosenInlineResult;
  if (!chosenResult) return;

  const resultId = chosenResult.result_id;
  const chatId = chosenResult.from.id;

  try {
    const resolution = await resolveChosenResultAttachments(resultId, {
      createAnnouncementsRepository: () => new AnnouncementsRepository(),
      createCalendarsRepository: () => new AcademicCalendarsRepository(),
      createTimetablesRepository: () => new ExamTimetablesRepository(),
    });

    if (resolution.status === "ignored") return;

    if (resolution.status !== "ready") {
      await ctx.api.sendMessage(chatId, resolution.message);
      return;
    }

    const plural = resolution.attachments.length > 1 ? "s" : "";
    const statusMessage = await ctx.api.sendMessage(
      chatId,
      `${emoji("hourglass_not_done")} Downloading your file${plural} from ${resolution.resource} in the background... Please wait!`
    );

    await addAttachmentDeliveryJob(
      buildAttachmentDeliveryJob(
        chatId,
        resolution.attachments,
        statusMessage.message_id
      )
    );
  } catch (error) {
    logger.error(
      { err: error, resultId, chatId },
      "Error in chosen inline result handler"
    );

    try {
      await ctx.api.sendMessage(
        chatId,
        joinWithNewlines([
          fmt`${emoji("crying_cat")} An error occurred while fetching attachments.`,
          fmt`Please try again.`,
        ]).text
      );
    } catch (notificationError) {
      logger.error(
        { err: notificationError, resultId, chatId },
        "Failed to notify user about chosen inline result error"
      );
    }
  }
});
