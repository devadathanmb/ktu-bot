import { BotContext } from "../../../types/bot.types.js";
import { Composer, InlineQueryResultBuilder } from "grammy";
import { createComposerErrorBoundary } from "../shared/error-boundary.js";
import { fmt } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import logger from "../../../utils/logger.js";
import type { InlineQueryResult } from "grammy/types";
import { addAttachmentDeliveryJob } from "../../../workers/attachment-delivery/queue.js";
import { parseQuery } from "./query.js";
import { addSearchAgainButton, buildHelpResults } from "./results.js";
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

  try {
    let results: InlineQueryResult[] = [];

    if (!type) {
      results = buildHelpResults();
    } else {
      switch (type) {
        case SearchType.ANNOUNCEMENTS:
          results = await searchAnnouncements(searchTerm);
          break;
        case SearchType.CALENDARS:
          results = await searchCalendars(searchTerm);
          break;
        case SearchType.TIMETABLES:
          results = await searchTimetables(searchTerm);
          break;
      }

      results = addSearchAgainButton(results, query);
    }

    await ctx.answerInlineQuery(results);
  } catch (error) {
    const chatId = ctx.from?.id;
    logger.error(
      { err: error as Error, chatId, query, type, searchTerm },
      "Error in inline query handler"
    );

    const errorResult = [
      InlineQueryResultBuilder.article(
        "-1",
        "KTU servers are having issues right now"
      ).text(
        "KTU servers are having issues right now. Please try again later."
      ),
    ];
    await ctx.answerInlineQuery(errorResult).catch();
  }
});

inlineQuery.on("chosen_inline_result", async ctx => {
  const chosenResult = ctx.chosenInlineResult;
  if (!chosenResult) return;

  const resultId = chosenResult.result_id;
  const chatId = chosenResult.from.id;

  try {
    const resolution = await resolveChosenResultAttachments(resultId);

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
      { err: error as Error, resultId, chatId },
      "Error in chosen inline result handler"
    );

    await ctx.api
      .sendMessage(
        chatId,
        joinWithNewlines([
          fmt`${emoji("crying_cat")} An error occurred while fetching attachments.`,
          fmt`Please try again.`,
        ]).text
      )
      .catch(() => {});
  }
});
