import { emoji } from "@grammyjs/emoji";
import { FormattedString, fmt, b } from "@grammyjs/parse-mode";
import { InlineKeyboard } from "grammy";
import { Announcement } from "../../../../types/service.types.js";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import {
  generatePaginatedKeyboard,
  generatePaginatedMessageText,
} from "../utils.js";

export function generateAnnouncementsKeyboard(
  announcements: Announcement[],
  currentPage: number
): InlineKeyboard {
  return generatePaginatedKeyboard(announcements, currentPage, "announcement");
}

export function generateAnnouncementsText(
  announcements: Announcement[]
): FormattedString {
  return generatePaginatedMessageText(
    announcements,
    `${emoji("loudspeaker")} Announcements`,
    "announcement"
  );
}

export function formatAnnouncementDetails(
  announcement: Announcement
): FormattedString {
  const parts: FormattedString[] = [];

  if (announcement.subject) {
    parts.push(
      joinWithNewlines(
        [
          fmt`${b}${emoji("open_book")} Title:${b}`,
          fmt`${announcement.subject}`,
        ],
        2
      )
    );
  }
  if (announcement.message) {
    parts.push(
      joinWithNewlines(
        [fmt`${b}${emoji("memo")} Message:${b}`, fmt`${announcement.message}`],
        2
      )
    );
  }
  if (announcement.formattedPublishedDate) {
    parts.push(
      fmt`${b}${emoji("calendar")} Published:${b} ${announcement.formattedPublishedDate}`
    );
  }

  return joinWithNewlines(parts, 2);
}
