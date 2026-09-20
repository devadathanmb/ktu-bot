import { InlineKeyboard, InlineQueryResultBuilder } from "grammy";
import type { InlineQueryResult } from "grammy/types";
import { emoji } from "@grammyjs/emoji";
import { b, fmt, type FormattedString } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../utils/formatting.js";
import type {
  AcademicCalendar,
  Announcement,
  ExamTimeTable,
} from "../../../types/service.types.js";
import {
  SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP,
  SPECIAL_RESULT_PREFIXES,
  SearchType,
} from "./search-types.js";
import {
  INLINE_ANNOUNCEMENTS_SEARCH_BUTTON,
  INLINE_CALENDARS_SEARCH_BUTTON,
  INLINE_TIMETABLES_SEARCH_BUTTON,
} from "./keyboards.js";

export function constructNoResultsFound(type: SearchType) {
  return [
    InlineQueryResultBuilder.article(
      `${SPECIAL_RESULT_PREFIXES.NO_RESULTS}${type}`,
      `${emoji("woman_shrugging")} No ${type} found`
    ).text(
      `${emoji("woman_shrugging")} No ${type} found for your search query.`
    ),
  ];
}

// Keeps the historical "-1" result ID that the previous fallback used.
export function buildTemporarySearchFailureResult(): InlineQueryResult[] {
  return [
    InlineQueryResultBuilder.article(
      "-1",
      "Search is temporarily unavailable"
    ).text("Search is temporarily unavailable. Please try again later."),
  ];
}

export function buildHelpResults(): InlineQueryResult[] {
  return [
    InlineQueryResultBuilder.article(
      `${SPECIAL_RESULT_PREFIXES.HELP}announcements`,
      `${emoji("loudspeaker")} Search Announcements`,
      {
        reply_markup: InlineKeyboard.from([INLINE_ANNOUNCEMENTS_SEARCH_BUTTON]),
      }
    ).text(
      `${emoji("loudspeaker")} Click the button below to start searching announcements!`
    ),
    InlineQueryResultBuilder.article(
      `${SPECIAL_RESULT_PREFIXES.HELP}calendars`,
      `${emoji("calendar")} Search Academic Calendars`,
      {
        reply_markup: InlineKeyboard.from([INLINE_CALENDARS_SEARCH_BUTTON]),
      }
    ).text(
      `${emoji("calendar")} Click the button below to start searching academic calendars!`
    ),
    InlineQueryResultBuilder.article(
      `${SPECIAL_RESULT_PREFIXES.HELP}timetables`,
      `${emoji("clipboard")} Search Exam Timetables`,
      {
        reply_markup: InlineKeyboard.from([INLINE_TIMETABLES_SEARCH_BUTTON]),
      }
    ).text(
      `${emoji("clipboard")} Click the button below to start searching exam timetables!`
    ),
  ];
}

export function renderAnnouncementResults(
  announcements: Announcement[]
): InlineQueryResult[] {
  const results = announcements.map(announcement => {
    const parts: FormattedString[] = [];
    if (announcement.subject) {
      parts.push(
        joinWithNewlines([
          fmt`${b}${emoji("open_book")} Subject:${b}`,
          fmt`${announcement.subject}`,
        ])
      );
    }
    if (announcement.message) {
      parts.push(
        joinWithNewlines([
          fmt`${b}${emoji("memo")} Message:${b}`,
          fmt`${announcement.message}`,
        ])
      );
    }
    if (announcement.formattedPublishedDate) {
      parts.push(
        joinWithNewlines([
          fmt`${b}${emoji("calendar")} Date:${b} ${announcement.formattedPublishedDate}`,
        ])
      );
    }

    const formattedMessage = joinWithNewlines(parts, 2);

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

export function renderCalendarResults(
  calendars: AcademicCalendar[]
): InlineQueryResult[] {
  const results = calendars.map(calendar => {
    const parts: FormattedString[] = [];
    if (calendar.title) {
      parts.push(
        joinWithNewlines([
          fmt`${b}${emoji("calendar")} Title:${b}`,
          fmt`${calendar.title}`,
        ])
      );
    }
    if (calendar.formattedPublishedDate) {
      parts.push(
        joinWithNewlines([
          fmt`${b}${emoji("calendar")} Date:${b} ${calendar.formattedPublishedDate}`,
        ])
      );
    }
    if (calendar.attachmentName) {
      parts.push(
        joinWithNewlines([
          fmt`${b}${emoji("paperclip")} Attachment:${b} ${calendar.attachmentName}`,
        ])
      );
    }

    const formattedMessage = joinWithNewlines(parts, 2);

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

export function renderTimetableResults(
  timetables: ExamTimeTable[]
): InlineQueryResult[] {
  const results = timetables.map(timetable => {
    const parts: FormattedString[] = [];
    if (timetable.title) {
      parts.push(
        joinWithNewlines([
          fmt`${b}${emoji("clipboard")} Title:${b}`,
          fmt`${timetable.title}`,
        ])
      );
    }
    if (timetable.formattedPublishedDate) {
      parts.push(
        joinWithNewlines([
          fmt`${b}${emoji("calendar")} Date:${b} ${timetable.formattedPublishedDate}`,
        ])
      );
    }
    if (timetable.fileName) {
      parts.push(
        joinWithNewlines([
          fmt`${b}${emoji("paperclip")} File:${b} ${timetable.fileName}`,
        ])
      );
    }

    const formattedMessage = joinWithNewlines(parts, 2);

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

export function addSearchAgainButton(
  results: InlineQueryResult[],
  originalQuery: string
): InlineQueryResult[] {
  const searchAgainKeyboard = new InlineKeyboard().switchInlineCurrent(
    `${emoji("high_voltage")} Search Again`,
    originalQuery
  );

  return results.map(result => {
    if (
      result.id?.startsWith(SPECIAL_RESULT_PREFIXES.HELP) ||
      result.id?.startsWith(SPECIAL_RESULT_PREFIXES.NO_RESULTS)
    ) {
      return result;
    }

    if (result.type === "article") {
      return {
        ...result,
        reply_markup: searchAgainKeyboard,
      };
    }

    return result;
  });
}
