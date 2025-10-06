import { InlineKeyboard } from "grammy";
import { fmt, b, i, FormattedString } from "@grammyjs/parse-mode";
import { shortenString, joinWithNewlines } from "../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";

export interface PaginatedItem {
  id: number;
  subject: string;
  formattedPublishedDate: string;
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
  itemType: string
): FormattedString {
  // Create individual formatted strings for each item
  const formattedItems: FormattedString[] = items.map((item, index) => {
    const shortSubject = fmt`${shortenString(item.subject)}`;
    const publishedDate = item.formattedPublishedDate;
    const indexPart = fmt`${index + 1}) ${shortSubject}`;
    const datePart = fmt`${i}Published date:${i} ${publishedDate}`;
    return joinWithNewlines([indexPart, datePart]);
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
