import { withTransaction } from "../../db/index.js";
import { AnnouncementSubscriptionRepository } from "../../db/repositories/announcement-subscription-repository.js";
import { ChatRepository } from "../../db/repositories/chat-repository.js";
import { Filter } from "grammy";
import { BotContext } from "../../types/bot.types.js";
import { joinWithNewlines, formatCommand } from "../../utils/formatting.js";
import { fmt } from "@grammyjs/parse-mode";
import { emoji } from "@grammyjs/emoji";
import logger from "../../utils/logger.js";
import { announcementsSubscribeCommandInfo } from "../composers/announcement-subscriptions/command-info.js";

/**
 * Database work for a `my_chat_member` update. Each method commits its own
 * transaction, so the unblock welcome can wait for a committed state and no
 * Telegram call is made while a transaction is open.
 */
export interface ChatMembershipPersistence {
  /** Commits the chat as active after an unblock. */
  markChatActive(chatId: number): Promise<void>;
  /** Atomically records the kick and clears announcement subscriptions. */
  markChatKicked(chatId: number): Promise<void>;
}

function createChatMembershipPersistence(): ChatMembershipPersistence {
  return {
    async markChatActive(chatId) {
      await withTransaction(async tx => {
        const chatRepo = new ChatRepository(tx);
        const chat = await chatRepo.getById(chatId);
        if (chat && chat.kickedAt) {
          await chatRepo.markActive(chatId);
        }
      });
    },

    async markChatKicked(chatId) {
      await withTransaction(async tx => {
        const chatRepo = new ChatRepository(tx);
        await chatRepo.markKicked(chatId);

        const announcementSubscriptionRepo =
          new AnnouncementSubscriptionRepository(tx);
        await announcementSubscriptionRepo.delete(chatId);
      });
    },
  };
}

const chatMembershipPersistence = createChatMembershipPersistence();

/**
 * Applies a `my_chat_member` status change. The unblocked welcome is sent only
 * after the active state is committed, and a kicked chat gets no reply after
 * its atomic kick-and-clear write.
 */
export async function handleChatMemberUpdate(
  ctx: Filter<BotContext, "my_chat_member">,
  persistence: ChatMembershipPersistence
): Promise<void> {
  const oldStatus = ctx.myChatMember.old_chat_member.status;
  const newStatus = ctx.myChatMember.new_chat_member.status;
  const chatId = ctx.chatId;

  if (oldStatus === "kicked" && newStatus !== "kicked") {
    logger.info({ chatId }, "User has unblocked the bot");

    await persistence.markChatActive(chatId);

    const messages = [
      fmt`Welcome back! It looks like you had previously blocked this bot ${emoji("smiling_face_with_tear")}, so your old subscriptions have been cleared for privacy reasons.`,
      fmt`You can easily resubscribe using ${formatCommand(announcementsSubscribeCommandInfo)}`,
      fmt`Thank you for giving me another chance! ${emoji("raising_hands")}`,
    ];

    const formattedReply = joinWithNewlines(messages, 2);
    await ctx.reply(formattedReply.text, {
      entities: formattedReply.entities,
    });
    return;
  }

  if (oldStatus !== "kicked" && newStatus === "kicked") {
    logger.info({ chatId }, "User has blocked the bot");
    await persistence.markChatKicked(chatId);
  }
}

export const chatMemberHandler = async (
  ctx: Filter<BotContext, "my_chat_member">
) => {
  await handleChatMemberUpdate(ctx, chatMembershipPersistence);
};
