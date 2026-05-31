import { withTransaction } from "../../db/index.js";
import { AnnouncementSubscriptionRepository } from "../../db/repositories/announcement-subscription-repository.js";
import { ChatRepository } from "../../db/repositories/chat-repository.js";
import { Filter } from "grammy";
import { BotContext } from "../../types/bot.types.js";
import { joinWithNewlines, formatCommand } from "../../utils/formatting.js";
import { fmt } from "@grammyjs/parse-mode";
import { emoji } from "@grammyjs/emoji";
import logger from "../../utils/logger.js";
import { announcementsSubscribeCommand } from "../composers/announcement-subscriptions/composer.js";

export const chatMemberHandler = async (
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

    if (oldStatus === "kicked" && newStatus !== "kicked") {
      logger.info({ chatId }, "User has unblocked the bot");

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

    if (oldStatus !== "kicked" && newStatus === "kicked") {
      logger.info({ chatId }, "User has blocked the bot");
      await chatRepo.markKicked(chatId);

      await announcementSubscriptionRepo.delete(chatId);
    }
  });

  return;
};
