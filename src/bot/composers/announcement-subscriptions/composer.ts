import { ANNOUNCEMENT_FILTER_MAP } from "../../../constants/courses.js";
import { getDb, withTransaction } from "../../../db/index.js";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/announcement-subscription-repository.js";
import { SessionNotFoundError } from "../../../errors/index.js";
import { BotContext } from "../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer } from "grammy";
import {
  generateFilterKeyboard,
  generateMessageText,
  MESSAGES,
} from "./helpers.js";
import { fmt, b } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../utils/formatting.js";
import { createAnnouncementSubscriptionErrorBoundary } from "../shared/error-boundary.js";
import { emoji } from "@grammyjs/emoji";
import {
  announcementsChangeFilterCommandInfo,
  announcementsShowStatusCommandInfo,
  announcementsSubscribeCommandInfo,
  announcementsUnsubscribeCommandInfo,
} from "./command-info.js";
import {
  applyAnnouncementFilters,
  unsubscribeFromAnnouncements,
  type SubscriptionChange,
} from "./workflows.js";

const composer = new Composer<BotContext>();
const protectedComposer = composer.errorBoundary(
  createAnnouncementSubscriptionErrorBoundary()
);

const announcementsSubscribeCommand = new Command<BotContext>(
  announcementsSubscribeCommandInfo.name,
  announcementsSubscribeCommandInfo.description,
  async ctx => {
    const chatId = ctx.chatId;
    const announcementSubscriptionRepo = new AnnouncementSubscriptionRepository(
      getDb()
    );

    const announcementSubscription =
      await announcementSubscriptionRepo.getByChatId(chatId);
    if (announcementSubscription) {
      const formattedMsg = joinWithNewlines(MESSAGES.ALREADY_SUBSCRIBED!, 2);
      await ctx.reply(formattedMsg.text, {
        entities: formattedMsg.entities,
      });
      return;
    }

    ctx.session.selectedFilters = [];
    const keyboard = generateFilterKeyboard(ctx.session.selectedFilters);
    const messageText = generateMessageText(ctx.session.selectedFilters);

    const message = await ctx.reply(messageText.text, {
      entities: messageText.entities,
      reply_markup: keyboard,
    });
    ctx.session.announcementSubscriptionMessageId = message.message_id;
  }
);

protectedComposer.callbackQuery(/^announcement_filter_select_/, async ctx => {
  await ctx.answerCallbackQuery();

  const prevMessageId = ctx.session.announcementSubscriptionMessageId;
  if (!prevMessageId) throw new SessionNotFoundError();

  const chatId = ctx.chatId!;
  const filter = ctx.callbackQuery.data.replace(
    "announcement_filter_select_",
    ""
  );

  if (!(filter in ANNOUNCEMENT_FILTER_MAP)) {
    const invalidMessage = `${emoji("cross_mark")} Invalid filter selected. Please try again.`;
    await ctx.api.editMessageText(chatId, prevMessageId, invalidMessage);
    return;
  }

  const filterIndex = ctx.session.selectedFilters.indexOf(filter);
  if (filterIndex === -1) {
    ctx.session.selectedFilters.push(filter);
  } else {
    ctx.session.selectedFilters.splice(filterIndex, 1);
  }

  const newKeyboard = generateFilterKeyboard(ctx.session.selectedFilters);
  const newMessageText = generateMessageText(ctx.session.selectedFilters);

  await ctx.api.editMessageText(chatId, prevMessageId, newMessageText.text, {
    entities: newMessageText.entities,
    reply_markup: newKeyboard,
  });
});

protectedComposer.callbackQuery("announcement_apply_filters", async ctx => {
  await applyAnnouncementFilters(
    ctx,
    async (chatId, filters): Promise<SubscriptionChange> => {
      return await withTransaction(async tx => {
        const announcementSubscriptionRepo =
          new AnnouncementSubscriptionRepository(tx);
        const existingSubscription =
          await announcementSubscriptionRepo.getByChatId(chatId);

        if (existingSubscription) {
          await announcementSubscriptionRepo.update(chatId, { filters });
          return "updated";
        }

        await announcementSubscriptionRepo.create({
          chatId: chatId,
          filters: filters,
        });
        return "created";
      });
    }
  );
});

const announcementsUnsubscribeCommand = new Command<BotContext>(
  announcementsUnsubscribeCommandInfo.name,
  announcementsUnsubscribeCommandInfo.description,
  async ctx => {
    await unsubscribeFromAnnouncements(ctx, async chatId => {
      return await withTransaction(async tx => {
        const announcementSubscriptionRepo =
          new AnnouncementSubscriptionRepository(tx);
        const announcementSubscription =
          await announcementSubscriptionRepo.getByChatId(chatId);
        if (!announcementSubscription) return false;

        await announcementSubscriptionRepo.delete(chatId);
        return true;
      });
    });
  }
);

const announcementsShowFilterCommand = new Command<BotContext>(
  announcementsShowStatusCommandInfo.name,
  announcementsShowStatusCommandInfo.description,
  async ctx => {
    const chatId = ctx.chatId;
    const announcementSubscriptionRepo = new AnnouncementSubscriptionRepository(
      getDb()
    );
    const announcementSubscription =
      await announcementSubscriptionRepo.getByChatId(chatId);

    if (!announcementSubscription) {
      const formattedMsg = joinWithNewlines(
        MESSAGES.NOT_SUBSCRIBED_WITH_EMOJI!,
        2
      );
      await ctx.reply(formattedMsg.text, {
        entities: formattedMsg.entities,
      });
      return;
    }

    const filterNames = announcementSubscription.filters.map(
      (filter: string) =>
        ANNOUNCEMENT_FILTER_MAP[
          filter as keyof typeof ANNOUNCEMENT_FILTER_MAP
        ] || filter
    );

    const filtersList = filterNames
      .map((name: string) => `   • ${name}`)
      .join("\n");
    const statusMessage = joinWithNewlines(
      [
        fmt`${emoji("check_mark_button")} ${b}Announcement Subscription Status${b}`,
        fmt`${emoji("clipboard")} ${b}Active Filters:${b} ${announcementSubscription.filters.length}`,
        fmt`${emoji("bullseye")} ${b}You are subscribed to:${b}\n${filtersList}`,
      ],
      2
    );
    const suggestionsMessage = joinWithNewlines(
      [
        fmt`${emoji("light_bulb")} Use /announcements_change_filter to modify your filters`,
        fmt`${emoji("cross_mark")} Use /announcements_unsubscribe to unsubscribe`,
      ],
      2
    );

    const combinedMessage = joinWithNewlines(
      [statusMessage, suggestionsMessage],
      2
    );

    await ctx.reply(combinedMessage.text, {
      entities: combinedMessage.entities,
    });
  }
);

const announcementsChangeFilterCommand = new Command<BotContext>(
  announcementsChangeFilterCommandInfo.name,
  announcementsChangeFilterCommandInfo.description,
  async ctx => {
    const chatId = ctx.chatId;
    const announcementSubscriptionRepo = new AnnouncementSubscriptionRepository(
      getDb()
    );

    const existingSubscription =
      await announcementSubscriptionRepo.getByChatId(chatId);
    if (!existingSubscription) {
      const formattedMsg = joinWithNewlines(
        MESSAGES.NOT_SUBSCRIBED_CHANGE_FILTER!
      );
      await ctx.reply(formattedMsg.text, {
        entities: formattedMsg.entities,
      });
      return;
    }

    ctx.session.selectedFilters = existingSubscription.filters || [];

    const keyboard = generateFilterKeyboard(ctx.session.selectedFilters);
    const messageText = generateMessageText(
      ctx.session.selectedFilters,
      "change"
    );
    const sentMessage = await ctx.reply(messageText.text, {
      entities: messageText.entities,
      reply_markup: keyboard,
    });

    ctx.session.announcementSubscriptionMessageId = sentMessage.message_id;
  }
);

const announcementSubscriptionsCommands = new CommandGroup<BotContext>();

announcementSubscriptionsCommands
  .add(announcementsSubscribeCommand)
  .add(announcementsUnsubscribeCommand)
  .add(announcementsShowFilterCommand)
  .add(announcementsChangeFilterCommand);

protectedComposer.use(announcementSubscriptionsCommands);

export {
  composer as announcementSubscriptions,
  announcementSubscriptionsCommands,
};
