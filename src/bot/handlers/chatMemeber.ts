import { withTransaction } from "../../db/index.js";
import { AnnouncementSubscriptionRepository } from "../../db/repositories/AnnouncementSubscriptionRepository.js";
import { ChatRepository } from "../../db/repositories/ChatRepository.js";
import { Filter } from "grammy";
import { BotContext } from "../../types/bot.types.js";
import { joinWithNewlines, formatCommand } from "../../utils/formatting.js";
import { fmt } from "@grammyjs/parse-mode";
import { emoji } from "@grammyjs/emoji";
import logger from "../../utils/logger.js";
import { announcementsSubscribeCommand } from "../composers/announcement-subscriptions/composer.js";

export const chatMemeberHandler = async (
  ctx: Filter<BotContext, "my_chat_member">
) => {
  await withTransaction(async tx => {
    const oldStatus = ctx.myChatMember.old_chat_member.status;
    const newStatus = ctx.myChatMember.new_chat_member.status;
    const chatId = ctx.chatId;

    const chatRepo = new ChatRepository(tx);
    const announcementSubscriptionRepo = new AnnouncementSubscriptionRepository(
      tx
    );

    // If oldStatus is 'kicked' and newStatus is not 'kicked', user has unblocked the bot
    if (oldStatus === "kicked" && newStatus !== "kicked") {
      logger.info(`User ${chatId} has unblocked the bot.`);

      // 1. Update DB to mark the user as unblocked
      const chat = await chatRepo.getById(chatId);
      if (chat && chat.kickedAt) {
        await chatRepo.markActive(chatId);
      }

      const messages = [
        fmt`Welcome back! It looks like you had previously blocked this bot ${emoji("smiling_face_with_tear")}, so your old subscriptions have been cleared for privacy reasons.`,
        fmt`You can easily resubscribe using ${formatCommand(announcementsSubscribeCommand)}`,
        fmt`Thank you for giving me another chance! ${emoji("raising_hands")}`,
      ];

      const formattedReply = joinWithNewlines(messages, 2);
      await ctx.reply(formattedReply.text, {
        entities: formattedReply.entities,
      });
    }

    // If oldStatus is not 'kicked' and newStatus is 'kicked', user has blocked the bot
    if (oldStatus !== "kicked" && newStatus === "kicked") {
      logger.info(`User ${chatId} has blocked the bot.`);
      // 1. Update DB to mark the user as blocked
      await chatRepo.markKicked(chatId);

      // 2. Remove the user from announcement subscriptions
      await announcementSubscriptionRepo.delete(chatId);
    }
  });

  return;
};
