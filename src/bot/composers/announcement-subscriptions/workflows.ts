import { CallbackQueryContext } from "grammy";
import { emoji } from "@grammyjs/emoji";
import { fmt, b } from "@grammyjs/parse-mode";
import { BotContext } from "../../../types/bot.types.js";
import { SessionNotFoundError } from "../../../errors/index.js";
import { ANNOUNCEMENT_FILTER_MAP } from "../../../constants/courses.js";
import { joinWithNewlines } from "../../../utils/formatting.js";
import { MESSAGES } from "./helpers.js";

export type SubscriptionChange = "created" | "updated";

/**
 * Applies the selected filters and confirms the change only after
 * `persistFilters` resolves. The callback owns the database transaction, so
 * the confirmation edit describes committed state, a rejected persist sends
 * nothing, and the session is not cleared before the write succeeds.
 */
export async function applyAnnouncementFilters(
  ctx: CallbackQueryContext<BotContext>,
  persistFilters: (
    chatId: number,
    filters: string[]
  ) => Promise<SubscriptionChange>
): Promise<void> {
  await ctx.answerCallbackQuery();

  const chatId = ctx.chatId!;
  const prevMessageId = ctx.session.announcementSubscriptionMessageId;
  if (!prevMessageId) throw new SessionNotFoundError();

  if (ctx.session.selectedFilters.length === 0) {
    const errorMessage = `${emoji("cross_mark")} Please select at least one filter before applying.`;
    await ctx.api.editMessageText(chatId, prevMessageId, errorMessage);
    return;
  }

  const change = await persistFilters(chatId, ctx.session.selectedFilters);

  if (change === "updated") {
    await ctx.api.editMessageText(
      chatId,
      prevMessageId,
      `${emoji("check_mark_button")} Your announcement filters have been updated successfully!`
    );
  } else {
    const selectedFilterNames = ctx.session.selectedFilters.map(
      (filter: string) =>
        ANNOUNCEMENT_FILTER_MAP[filter as keyof typeof ANNOUNCEMENT_FILTER_MAP]
    );
    const successMessage = joinWithNewlines(
      [
        fmt`${emoji("check_mark_button")} Successfully subscribed to announcements!`,
        fmt`${b}Your selected filters:${b} ${selectedFilterNames.join(", ")}`,
      ],
      2
    );

    await ctx.api.editMessageText(chatId, prevMessageId, successMessage.text, {
      entities: successMessage.entities,
    });
  }

  ctx.session.selectedFilters = [];
  ctx.session.announcementSubscriptionMessageId = null;
}

/**
 * Confirms an unsubscribe only after `deleteSubscription` resolves. The
 * callback owns the transaction and reports whether a row was removed, so the
 * success reply never precedes the delete and a failed delete sends nothing.
 */
export async function unsubscribeFromAnnouncements(
  ctx: BotContext,
  deleteSubscription: (chatId: number) => Promise<boolean>
): Promise<void> {
  const removed = await deleteSubscription(ctx.chatId!);

  const formattedMsg = removed
    ? joinWithNewlines(MESSAGES.UNSUBSCRIBE_SUCCESS!)
    : joinWithNewlines(MESSAGES.NOT_SUBSCRIBED_WITH_EMOJI!, 2);

  await ctx.reply(formattedMsg.text, {
    entities: formattedMsg.entities,
  });
}
