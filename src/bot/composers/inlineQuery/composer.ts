import { BotContext } from "../../../types/bot.types.js";
import { Composer, InlineKeyboard, InlineQueryResultBuilder } from "grammy";
import { createComposerErrorBoundary } from "../shared/errorBoundary.js";
import { AnnouncementsRepository } from "../../../db/repositories/AnnouncementsRepository.js";
import { AcademicCalendarsRepository } from "../../../db/repositories/AcademicCalendarsRepository.js";
import { ExamTimetablesRepository } from "../../../db/repositories/ExamTimetablesRepository.js";
import { createGrammyInputFileFromAttachment } from "../../../utils/fileUtils.js";
import { fmt, b } from "@grammyjs/parse-mode";
import type { FormattedString } from "@grammyjs/parse-mode";
import {
  combineFormattedDouble,
  combineFormattedSingle,
} from "../../../utils/combineFormatted.js";
import { emoji } from "@grammyjs/emoji";
import logger from "../../../utils/logger.js";
import type { InlineQueryResult } from "grammy/types";
import {
  INLINE_ANNOUNCEMENTS_SEARCH_BUTTON,
  INLINE_CALENDARS_SEARCH_BUTTON,
  INLINE_TIMETABLES_SEARCH_BUTTON,
} from "./keyboards.js";

interface AttachmentInfo {
  name: string;
  encryptId: string;
}

export const inlineQuery = new Composer<BotContext>();

// Add error boundary
inlineQuery.errorBoundary(createComposerErrorBoundary([]));

// Define search types enum as single source of truth
enum SearchType {
  ANNOUNCEMENTS = "announcements",
  CALENDARS = "calendars",
  TIMETABLES = "timetables",
}

// Define search prefixes mapped to search types
const SEARCH_PREFIXES_TO_TYPE_MAP: Record<string, SearchType> = {
  "ann:": SearchType.ANNOUNCEMENTS,
  "cal:": SearchType.CALENDARS,
  "tt:": SearchType.TIMETABLES,
} as const;

// Define result ID prefixes for each search type
const SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP: Record<SearchType, string> = {
  [SearchType.ANNOUNCEMENTS]: "ann",
  [SearchType.CALENDARS]: "cal",
  [SearchType.TIMETABLES]: "tt",
} as const;

// Helper to construct no-results-found response
function constructNoResultsFound(type: SearchType) {
  return [
    InlineQueryResultBuilder.article(
      `no_${type}`,
      `${emoji("woman_shrugging")} No ${type} found`
    ).text(
      `${emoji("woman_shrugging")} No ${type} found for your search query.`
    ),
  ];
}

/**
 * Parse query to extract search type and actual search terms
 */
function parseQuery(query: string): {
  type: SearchType | null;
  searchTerm: string;
} {
  const trimmedQuery = query.trim();

  for (const [prefix, type] of Object.entries(SEARCH_PREFIXES_TO_TYPE_MAP)) {
    if (trimmedQuery.startsWith(prefix)) {
      return {
        type,
        searchTerm: trimmedQuery.slice(prefix.length).trim(),
      };
    }
  }

  return { type: null, searchTerm: trimmedQuery };
}

/**
 * Get search type from result ID prefix
 */
function getSearchTypeFromPrefix(prefix: string): SearchType | null {
  for (const [searchType, idPrefix] of Object.entries(
    SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP
  )) {
    if (idPrefix === prefix) {
      return searchType as SearchType;
    }
  }
  return null;
}

/**
 * Search announcements and format results
 */
async function searchAnnouncements(
  searchTerm: string
): Promise<InlineQueryResult[]> {
  const repo = new AnnouncementsRepository();

  const dbAnnouncements = searchTerm.trim()
    ? await repo.search(searchTerm, { limit: 50 })
    : await repo.getAll({ limit: 50 });

  const announcements = dbAnnouncements.map(dbAnnouncement =>
    AnnouncementsRepository.transformToApi(dbAnnouncement)
  );

  const results = announcements.map(announcement => {
    const parts: FormattedString[] = [];
    if (announcement.subject) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("open_book")} Subject:${b}`,
          fmt`${announcement.subject}`,
        ])
      );
    }
    if (announcement.message) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("memo")} Message:${b}`,
          fmt`${announcement.message}`,
        ])
      );
    }
    if (announcement.formattedPublishedDate) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("calendar")} Date:${b} ${announcement.formattedPublishedDate}`,
        ])
      );
    }

    const formattedMessage = combineFormattedDouble(parts);

    return InlineQueryResultBuilder.article(
      `${SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP[SearchType.ANNOUNCEMENTS]}_${announcement.id}`,
      announcement.subject || "No Subject",
      {
        description: announcement.message || "",
      }
    ).text(formattedMessage.text, { entities: formattedMessage.entities });
  });

  if (results.length === 0) {
    return constructNoResultsFound(SearchType.ANNOUNCEMENTS);
  }

  return results;
}

/**
 * Search academic calendars and format results
 */
async function searchCalendars(
  searchTerm: string
): Promise<InlineQueryResult[]> {
  const repo = new AcademicCalendarsRepository();

  const dbCalendars = searchTerm.trim()
    ? await repo.search(searchTerm, { limit: 50 })
    : await repo.getAll({ limit: 50 });

  const calendars = dbCalendars.map(dbCalendar =>
    AcademicCalendarsRepository.transformToApi(dbCalendar)
  );

  const results = calendars.map(calendar => {
    const parts: FormattedString[] = [];
    if (calendar.title) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("calendar")} Title:${b}`,
          fmt`${calendar.title}`,
        ])
      );
    }
    if (calendar.formattedPublishedDate) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("calendar")} Date:${b} ${calendar.formattedPublishedDate}`,
        ])
      );
    }
    if (calendar.attachmentName) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("paperclip")} Attachment:${b} ${calendar.attachmentName}`,
        ])
      );
    }

    const formattedMessage = combineFormattedDouble(parts);

    return InlineQueryResultBuilder.article(
      `${SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP[SearchType.CALENDARS]}_${calendar.id}`,
      calendar.title || "No Title",
      {
        description: calendar.title || "",
      }
    ).text(formattedMessage.text, { entities: formattedMessage.entities });
  });

  if (results.length === 0) {
    return constructNoResultsFound(SearchType.CALENDARS);
  }

  return results;
}

/**
 * Search exam timetables and format results
 */
async function searchTimetables(
  searchTerm: string
): Promise<InlineQueryResult[]> {
  const repo = new ExamTimetablesRepository();

  const dbTimetables = searchTerm.trim()
    ? await repo.search(searchTerm, { limit: 50 })
    : await repo.getAll({ limit: 50 });

  const timetables = dbTimetables.map(dbTimetable =>
    ExamTimetablesRepository.transformToApi(dbTimetable)
  );

  const results = timetables.map(timetable => {
    const parts: FormattedString[] = [];
    if (timetable.title) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("clipboard")} Title:${b}`,
          fmt`${timetable.title}`,
        ])
      );
    }
    if (timetable.formattedPublishedDate) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("calendar")} Date:${b} ${timetable.formattedPublishedDate}`,
        ])
      );
    }
    if (timetable.fileName) {
      parts.push(
        combineFormattedSingle([
          fmt`${b}${emoji("paperclip")} File:${b} ${timetable.fileName}`,
        ])
      );
    }

    const formattedMessage = combineFormattedDouble(parts);

    return InlineQueryResultBuilder.article(
      `${SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP[SearchType.TIMETABLES]}_${timetable.id}`,
      timetable.title || "No Title",
      {
        description: timetable.title || "",
      }
    ).text(formattedMessage.text, { entities: formattedMessage.entities });
  });

  if (results.length === 0) {
    return constructNoResultsFound(SearchType.TIMETABLES);
  }

  return results;
}

inlineQuery.on("inline_query", async ctx => {
  const query = ctx.inlineQuery?.query || "";
  const { type, searchTerm } = parseQuery(query);

  try {
    let results: InlineQueryResult[] = [];

    if (!type) {
      // No prefix provided - show help with 3 separate search type options
      results = [
        InlineQueryResultBuilder.article(
          "help_announcements",
          `${emoji("loudspeaker")} Search Announcements`,
          {
            reply_markup: InlineKeyboard.from([
              INLINE_ANNOUNCEMENTS_SEARCH_BUTTON,
            ]),
          }
        ).text(
          `${emoji("loudspeaker")} Click the button below to start searching announcements!`
        ),
        InlineQueryResultBuilder.article(
          "help_calendars",
          `${emoji("calendar")} Search Academic Calendars`,
          {
            reply_markup: InlineKeyboard.from([INLINE_CALENDARS_SEARCH_BUTTON]),
          }
        ).text(
          `${emoji("calendar")} Click the button below to start searching academic calendars!`
        ),
        InlineQueryResultBuilder.article(
          "help_timetables",
          `${emoji("clipboard")} Search Exam Timetables`,
          {
            reply_markup: InlineKeyboard.from([
              INLINE_TIMETABLES_SEARCH_BUTTON,
            ]),
          }
        ).text(
          `${emoji("clipboard")} Click the button below to start searching exam timetables!`
        ),
      ];
    } else {
      // Search based on type
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
    }

    await ctx.answerInlineQuery(results);
  } catch (error) {
    logger.error(
      { error, query, type, searchTerm },
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
  const userId = chosenResult.from.id;

  // Skip help and no-results items (help items already have keyboards)
  if (resultId.startsWith("help_") || resultId.startsWith("no_")) {
    return;
  }

  try {
    // Parse the result ID to determine type and actual ID
    const [prefix, id] = resultId.split("_");

    if (!prefix || !id) {
      await ctx.api.sendMessage(
        userId,
        `${emoji("cross_mark")} Invalid result format.`
      );
      return;
    }

    const searchType = getSearchTypeFromPrefix(prefix);

    if (!searchType) {
      await ctx.api.sendMessage(
        userId,
        `${emoji("cross_mark")} Unknown resource type.`
      );
      return;
    }

    let attachments: AttachmentInfo[] = [];
    let resourceName = "";

    switch (searchType) {
      case SearchType.ANNOUNCEMENTS: {
        const repo = new AnnouncementsRepository();
        const dbAnnouncement = await repo.getById(Number(id));

        if (!dbAnnouncement) {
          await ctx.api.sendMessage(
            userId,
            `${emoji("cross_mark")} Announcement not found.`
          );
          return;
        }

        const announcement =
          AnnouncementsRepository.transformToApi(dbAnnouncement);
        attachments = announcement.attachments;
        resourceName = "announcement";
        break;
      }
      case SearchType.CALENDARS: {
        const repo = new AcademicCalendarsRepository();
        const dbCalendar = await repo.getById(Number(id));

        if (!dbCalendar) {
          await ctx.api.sendMessage(
            userId,
            `${emoji("cross_mark")} Academic calendar not found.`
          );
          return;
        }

        const calendar = AcademicCalendarsRepository.transformToApi(dbCalendar);
        attachments = [
          { name: calendar.attachmentName, encryptId: calendar.encryptId },
        ];
        resourceName = "academic calendar";
        break;
      }
      case SearchType.TIMETABLES: {
        const repo = new ExamTimetablesRepository();
        const dbTimetable = await repo.getById(Number(id));

        if (!dbTimetable) {
          await ctx.api.sendMessage(
            userId,
            `${emoji("cross_mark")} Exam timetable not found.`
          );
          return;
        }

        const timetable = ExamTimetablesRepository.transformToApi(dbTimetable);
        if (timetable.fileName && timetable.encryptId) {
          attachments = [
            { name: timetable.fileName, encryptId: timetable.encryptId },
          ];
        } else {
          attachments = [];
        }
        resourceName = "exam timetable";
        break;
      }
    }

    if (attachments.length === 0) {
      await ctx.api.sendMessage(
        userId,
        `${emoji("information")} No attachments found for this ${resourceName}.`
      );
      return;
    }

    // Send initial message that we'll update for each attachment
    let statusMessage = await ctx.api.sendMessage(
      userId,
      `${emoji("hourglass_not_done")} Fetching ${attachments.length} attachment${attachments.length > 1 ? "s" : ""} from ${resourceName}...`
    );

    for (let i = 0; i < attachments.length; i++) {
      const attachment = attachments[i]!;

      try {
        // Update status message for current attachment
        await ctx.api.editMessageText(
          userId,
          statusMessage.message_id,
          `${emoji("hourglass_not_done")} Fetching attachment ${i + 1}/${attachments.length}: ${attachment.name}...`
        );

        const inputFile = await createGrammyInputFileFromAttachment(
          attachment.encryptId,
          attachment.name
        );

        await ctx.api.sendDocument(userId, inputFile, {
          caption: `${emoji("paperclip")} ${attachment.name}`,
        });
      } catch (attachmentError) {
        logger.error(
          { error: attachmentError, attachment },
          "Failed to fetch attachment"
        );
        await ctx.api.sendMessage(
          userId,
          `${emoji("warning")} Failed to fetch: ${attachment.name}`
        );
      }
    }

    // Update final status message
    await ctx.api.editMessageText(
      userId,
      statusMessage.message_id,
      `${emoji("check_mark_button")} Successfully sent ${attachments.length} attachment${attachments.length > 1 ? "s" : ""}!`
    );
  } catch (error) {
    logger.error(
      { error, resultId, userId },
      "Error in chosen inline result handler"
    );
    await ctx.api
      .sendMessage(
        userId,
        `${emoji("cross_mark")} An error occurred while fetching attachments. Please try again later.`
      )
      .catch();
  }
});
