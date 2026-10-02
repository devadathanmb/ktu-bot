import { FormattedString } from "@grammyjs/parse-mode";
import { InlineKeyboard } from "grammy";
import { Announcement } from "../../../../types/service.types.js";
import { documentCard, ICON } from "../../../../utils/message-style.js";
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
    ICON.announcements,
    "Announcements"
  );
}

export function formatAnnouncementDetails(
  announcement: Announcement
): FormattedString {
  return documentCard({
    title: announcement.subject,
    message: announcement.message,
    published: announcement.formattedPublishedDate,
  });
}
