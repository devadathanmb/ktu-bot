import { InlineKeyboard, InlineQueryResultBuilder } from "grammy";
import type { InlineQueryResult } from "grammy/types";
import { emoji } from "@grammyjs/emoji";
import { fmt } from "@grammyjs/parse-mode";
import { blocks, ICON, problem } from "../../../utils/message-style.js";
import { formatAnnouncementDetails } from "../lookups/announcements/views.js";
import { formatCalendarDetails } from "../lookups/academic-calendar/views.js";
import { formatTimetableDetails } from "../lookups/exam-timetable/views.js";
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
      blocks([
        fmt`${ICON.search} No ${type} found.`,
        fmt`Try different keywords or a shorter search.`,
      ]).text
    ),
  ];
}

// Keeps the historical "-1" result ID that the previous fallback used.
export function buildTemporarySearchFailureResult(): InlineQueryResult[] {
  return [
    InlineQueryResultBuilder.article(
      "-1",
      "Search is temporarily unavailable"
    ).text(
      problem(
        "Search is temporarily unavailable.",
        "Please try again in a few minutes."
      ).text
    ),
  ];
}

export function buildHelpResults(): InlineQueryResult[] {
  return [
    InlineQueryResultBuilder.article(
      `${SPECIAL_RESULT_PREFIXES.HELP}announcements`,
      `${ICON.announcements} Search Announcements`,
      {
        reply_markup: InlineKeyboard.from([INLINE_ANNOUNCEMENTS_SEARCH_BUTTON]),
      }
    ).text(
      `${ICON.announcements} Tap the button below to search announcements.`
    ),
    InlineQueryResultBuilder.article(
      `${SPECIAL_RESULT_PREFIXES.HELP}calendars`,
      `${ICON.calendars} Search Academic Calendars`,
      {
        reply_markup: InlineKeyboard.from([INLINE_CALENDARS_SEARCH_BUTTON]),
      }
    ).text(
      `${ICON.calendars} Tap the button below to search academic calendars.`
    ),
    InlineQueryResultBuilder.article(
      `${SPECIAL_RESULT_PREFIXES.HELP}timetables`,
      `${ICON.timetables} Search Exam Timetables`,
      {
        reply_markup: InlineKeyboard.from([INLINE_TIMETABLES_SEARCH_BUTTON]),
      }
    ).text(
      `${ICON.timetables} Tap the button below to search exam timetables.`
    ),
  ];
}

export function renderAnnouncementResults(
  announcements: Announcement[]
): InlineQueryResult[] {
  const results = announcements.map(announcement => {
    const formattedMessage = formatAnnouncementDetails(announcement);

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
    const formattedMessage = formatCalendarDetails(calendar);

    return InlineQueryResultBuilder.article(
      `${SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP[SearchType.CALENDARS]}_${calendar.id}`,
      calendar.title || "No Title",
      {
        description: `Published ${calendar.formattedPublishedDate}`,
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
    const formattedMessage = formatTimetableDetails(timetable);

    return InlineQueryResultBuilder.article(
      `${SEARCH_TYPE_TO_RESULT_ID_PREFIX_MAP[SearchType.TIMETABLES]}_${timetable.id}`,
      timetable.title || "No Title",
      {
        description: `Published ${timetable.formattedPublishedDate}`,
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
    `${ICON.search} Search again`,
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
