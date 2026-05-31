import { InlineKeyboard } from "grammy";
import { fmt, b, i, FormattedString } from "@grammyjs/parse-mode";
import { shortenString, joinWithNewlines } from "../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { BotContext } from "../../../types/bot.types.js";
import { SessionNotFoundError } from "../../../errors/index.js";
import { LOOKUP_CONFIG } from "./constants.js";

export type LookupMessageIdSessionKey =
  | "announcementsMessageId"
  | "calendarMessageId"
  | "timetableMessageId"
  | "syllabusMessageId";

interface ApiPaginatedLookupConfig<TItem> {
  messageIdSessionKey: LookupMessageIdSessionKey;
  getPage(ctx: BotContext): number | null;
  setPage(ctx: BotContext, page: number | null): void;
  getItems(ctx: BotContext): TItem[];
  setItems(ctx: BotContext, items: TItem[]): void;
  fetchPage(page: number): Promise<TItem[]>;
  buildKeyboard(items: TItem[], page: number): InlineKeyboard;
  buildText(items: TItem[]): FormattedString;
  loadingMessage: FormattedString;
}

async function renderApiPage<TItem>(
  ctx: BotContext,
  config: ApiPaginatedLookupConfig<TItem>,
  page: number,
  items: TItem[]
): Promise<void> {
  config.setPage(ctx, page);
  config.setItems(ctx, items);

  const keyboard = config.buildKeyboard(items, page);
  const messageText = config.buildText(items);

  await ctx.editMessageText(messageText.text, {
    reply_markup: keyboard,
    entities: messageText.entities,
  });
}

export async function fetchAndRenderApiPage<TItem>(
  ctx: BotContext,
  config: ApiPaginatedLookupConfig<TItem>,
  page = config.getPage(ctx) ?? LOOKUP_CONFIG.INITIAL_PAGE
): Promise<void> {
  storeCallbackMessageId(ctx, config.messageIdSessionKey);

  await ctx.editMessageText(config.loadingMessage.text, {
    entities: config.loadingMessage.entities,
  });

  const items = await config.fetchPage(page);
  await renderApiPage(ctx, config, page, items);
}

export async function startApiPaginatedLookup<TItem>(
  ctx: BotContext,
  config: ApiPaginatedLookupConfig<TItem>,
  initialMessageId: number
): Promise<void> {
  const page = config.getPage(ctx) ?? LOOKUP_CONFIG.INITIAL_PAGE;
  const items = await config.fetchPage(page);
  config.setPage(ctx, page);
  config.setItems(ctx, items);

  const keyboard = config.buildKeyboard(items, page);
  const messageText = config.buildText(items);

  await ctx.api.editMessageText(
    ctx.chat!.id,
    initialMessageId,
    messageText.text,
    {
      reply_markup: keyboard,
      entities: messageText.entities,
    }
  );
}

export async function handleApiPreviousPage<TItem>(
  ctx: BotContext,
  config: ApiPaginatedLookupConfig<TItem>
): Promise<void> {
  const currentPage = config.getPage(ctx) ?? LOOKUP_CONFIG.INITIAL_PAGE;
  if (currentPage === LOOKUP_CONFIG.INITIAL_PAGE) {
    await ctx.answerCallbackQuery("You are already on the first page.");
    return;
  }

  await ctx.answerCallbackQuery();
  await fetchAndRenderApiPage(ctx, config, currentPage - 1);
}

export async function handleApiNextPage<TItem>(
  ctx: BotContext,
  config: ApiPaginatedLookupConfig<TItem>
): Promise<void> {
  const currentPage = config.getPage(ctx) ?? LOOKUP_CONFIG.INITIAL_PAGE;

  if (config.getItems(ctx).length < LOOKUP_CONFIG.PAGE_SIZE) {
    await ctx.answerCallbackQuery("You are already on the last page.");
    return;
  }

  const nextPage = currentPage + 1;
  const items = await config.fetchPage(nextPage);

  if (items.length === 0) {
    await ctx.answerCallbackQuery("You are already on the last page.");
    return;
  }

  await ctx.answerCallbackQuery();
  storeCallbackMessageId(ctx, config.messageIdSessionKey);
  await renderApiPage(ctx, config, nextPage, items);
}

export interface PaginatedItem {
  id: number;
  subject: string;
  formattedPublishedDate: string;
}

export function slicePage<T>(items: T[], page: number): T[] {
  const start = page * LOOKUP_CONFIG.PAGE_SIZE;
  return items.slice(start, start + LOOKUP_CONFIG.PAGE_SIZE);
}

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

export function parseSelectCallback(
  callbackData: string,
  expectedPrefix: string
): { isValid: true; id: number } | { isValid: false; id: null; error: string } {
  const parts = callbackData.split("_");

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
