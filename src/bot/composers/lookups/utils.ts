import { InlineKeyboard } from "grammy";
import { fmt, b, i, FormattedString } from "@grammyjs/parse-mode";
import { shortenString, joinWithNewlines } from "../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { BotContext } from "../../../types/bot.types.js";
import { SessionNotFoundError } from "../../../errors/index.js";
import { LOOKUP_CONFIG } from "./constants.js";

export interface PaginatedItem {
  id: number;
  subject: string;
  formattedPublishedDate: string;
}

/**
 * Slice a full list to the items for the given page number
 */
export function slicePage<T>(items: T[], page: number): T[] {
  const start = page * LOOKUP_CONFIG.PAGE_SIZE;
  return items.slice(start, start + LOOKUP_CONFIG.PAGE_SIZE);
}

/**
 * Calculate total pages for a given item count
 */
export function totalPages(itemCount: number): number {
  return Math.max(1, Math.ceil(itemCount / LOOKUP_CONFIG.PAGE_SIZE));
}

export function generatePaginatedKeyboard(
  items: PaginatedItem[],
  currentPage: number,
  callbackPrefix: string,
  itemsPerRow: number = 5
): InlineKeyboard {
  const keyboard = new InlineKeyboard();

  const itemButtons: Array<{ text: string; callback_data: string }> = [];
  items.forEach((item, index) => {
    itemButtons.push({
      text: `${index + 1}`,
      callback_data: `${callbackPrefix}_select_${item.id}`,
    });
  });

  for (let i = 0; i < itemButtons.length; i += itemsPerRow) {
    const rowButtons = itemButtons.slice(i, i + itemsPerRow);
    for (const button of rowButtons) {
      keyboard.text(button.text, button.callback_data);
    }
    keyboard.row();
  }

  keyboard
    .text(`${emoji("fast_reverse_button")} Prev`, `${callbackPrefix}_prev_page`)
    .text(`Page: ${currentPage + 1}`, `${callbackPrefix}_page_info`)
    .text(
      `${emoji("fast_forward_button")} Next`,
      `${callbackPrefix}_next_page`
    );

  return keyboard;
}

export function generatePaginatedMessageText(
  items: PaginatedItem[],
  title: string,
  itemType: string,
  subtitleLabel = "Published date"
): FormattedString {
  // Create individual formatted strings for each item
  const formattedItems: FormattedString[] = items.map((item, index) => {
    const shortSubject = fmt`${shortenString(item.subject)}`;
    const publishedDate = item.formattedPublishedDate;
    const indexPart = fmt`${index + 1}) ${shortSubject}`;
    if (publishedDate) {
      const datePart = fmt`${i}${subtitleLabel}:${i} ${publishedDate}`;
      return joinWithNewlines([indexPart, datePart]);
    }
    return indexPart;
  });

  // Join all items with double newlines
  const itemsList = joinWithNewlines(formattedItems, 2);

  const titlePart = fmt`${b}${title}:${b}`;
  const instructionsPart1 = fmt`${emoji("backhand_index_pointing_down")} ${b}Choose a ${itemType} using the buttons below${b}`;
  const instructionsPart2 = fmt`${emoji("left_right_arrow")} ${b}Use the navigation buttons to browse pages${b}`;
  const instructions = joinWithNewlines(
    [instructionsPart1, instructionsPart2],
    2
  );

  return joinWithNewlines([titlePart, itemsList, instructions], 2);
}

/**
 * Parse a select callback to extract the ID safely
 *
 * @param callbackData - Callback data string (e.g., "announcement_select_123")
 * @param expectedPrefix - Expected prefix (e.g., "announcement")
 * @returns Parsed result with validation
 *
 * @example
 * const result = parseSelectCallback("announcement_select_42", "announcement");
 * if (!result.isValid) {
 *   // Handle error
 *   return;
 * }
 * const id = result.id; // TypeScript knows this is number
 */
export function parseSelectCallback(
  callbackData: string,
  expectedPrefix: string
): { isValid: true; id: number } | { isValid: false; id: null; error: string } {
  const parts = callbackData.split("_");

  // Validate format: prefix_select_id
  if (parts.length < 3) {
    return { isValid: false, id: null, error: "Invalid callback format" };
  }

  if (parts[0] !== expectedPrefix || parts[1] !== "select") {
    return { isValid: false, id: null, error: "Unexpected callback prefix" };
  }

  const idStr = parts[2];
  if (!idStr) {
    return { isValid: false, id: null, error: "Missing ID in callback" };
  }

  const id = parseInt(idStr, 10);
  if (isNaN(id)) {
    return { isValid: false, id: null, error: "Invalid ID format" };
  }

  return { isValid: true, id };
}

/**
 * Create standardized "View Another?" keyboard
 *
 * @param callbackPrefix - Prefix for callback data (e.g., "announcement")
 * @returns InlineKeyboard with yes/no buttons
 */
export function createViewAnotherKeyboard(
  callbackPrefix: string
): InlineKeyboard {
  return new InlineKeyboard()
    .text(
      `${emoji("check_mark_button")} Yes`,
      `${callbackPrefix}_view_another_true`
    )
    .text(`${emoji("cross_mark")} No`, `${callbackPrefix}_view_another_false`);
}

/**
 * Safely find an item by ID from an array
 *
 * @param items - Array of items to search
 * @param id - ID to find
 * @returns Found item
 * @throws SessionNotFoundError if item not found
 */
export function findItemById<T extends { id: number }>(
  items: T[],
  id: number
): T {
  const item = items.find(item => item.id === id);
  if (!item) {
    throw new SessionNotFoundError();
  }
  return item;
}

/**
 * Safely store message ID from callback query message
 *
 * @param ctx - Bot context
 * @param sessionKey - Session key to store message ID
 */
export function storeCallbackMessageId(
  ctx: BotContext,
  sessionKey:
    | "announcementsMessageId"
    | "calendarMessageId"
    | "timetableMessageId"
    | "syllabusMessageId"
): void {
  const messageId = ctx.callbackQuery?.message?.message_id;
  if (messageId !== undefined) {
    ctx.session[sessionKey] = messageId;
  }
}
