import { CallbackQueryContext } from "grammy";
import { BotContext } from "../../../types/bot.types.js";
import { SessionNotFoundError } from "../../../errors/index.js";
import { ANNOUNCEMENT_FILTER_MAP } from "../../../constants/courses.js";
import {
  blocks,
  bullets,
  problem,
  success,
} from "../../../utils/message-style.js";
import { editMessageIgnoringNotModified } from "../../../utils/bot.js";
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
    const errorMessage = problem(
      "Pick at least one category first.",
      "Choose a category, then tap “Save categories”."
    ).text;
    await editMessageIgnoringNotModified(() =>
      ctx.api.editMessageText(chatId, prevMessageId, errorMessage)
    );
    return;
  }

  const change = await persistFilters(chatId, ctx.session.selectedFilters);

  const selectedFilterNames = ctx.session.selectedFilters.map(
    (filter: string) =>
      ANNOUNCEMENT_FILTER_MAP[filter as keyof typeof ANNOUNCEMENT_FILTER_MAP]
  );
  const confirmation = blocks([
    change === "updated"
      ? success("Categories updated. You’ll get alerts for:")
      : success("Alerts are on. I’ll message you about:"),
    bullets(selectedFilterNames),
  ]);

  await editMessageIgnoringNotModified(() =>
    ctx.api.editMessageText(chatId, prevMessageId, confirmation.text, {
      entities: confirmation.entities,
    })
  );

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
    ? MESSAGES.UNSUBSCRIBE_SUCCESS
    : MESSAGES.NOT_SUBSCRIBED;

  await ctx.reply(formattedMsg.text, {
    entities: formattedMsg.entities,
  });
}
