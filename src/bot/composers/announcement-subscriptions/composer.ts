import { ANNOUNCEMENT_FILTER_MAP } from "../../../constants/courses.js";
import { withTransaction } from "../../../db/index.js";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/announcement-subscription-repository.js";
import { SessionNotFoundError } from "../../../errors/index.js";
import { BotContext } from "../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer } from "grammy";
import { generateFilterKeyboard, generateMessageText } from "./helpers.js";
import { fmt, b, FormattedString } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../utils/formatting.js";
import { createAnnouncementSubscriptionErrorBoundary } from "../shared/error-boundary.js";
import { emoji } from "@grammyjs/emoji";

const MESSAGES: Record<string, Array<FormattedString>> = {
  ALREADY_SUBSCRIBED: [
    fmt`${emoji("bell")} You are already subscribed to announcements!`,
    fmt`Use /announcements_show_status to check your announcement subscription status.`,
  ],
  NOT_SUBSCRIBED_WITH_EMOJI: [
    fmt`${emoji("cross_mark")} You are not subscribed to announcements.`,
    fmt`Use /announcements_subscribe to subscribe to announcements.`,
  ],
  NOT_SUBSCRIBED_CHANGE_FILTER: [
    fmt`${emoji("cross_mark")} You are not subscribed to announcements.`,
    fmt`${emoji("light_bulb")} Use /announcements_subscribe to subscribe first.`,
  ],
  UNSUBSCRIBE_SUCCESS: [
    fmt`${emoji("crying_face")} I'm sorry to see you go! You have been successfully unsubscribed from announcements.`,
    fmt`If you change your mind, you can always use /announcements_subscribe to subscribe again.`,
  ],
} as const;

export const announcementSubscriptions = new Composer<BotContext>();

const protectedComposer = new Composer<BotContext>();
protectedComposer.errorBoundary(createAnnouncementSubscriptionErrorBoundary());

announcementSubscriptions.use(protectedComposer);

const announcementsSubscribeCommand = new Command<BotContext>(
  "announcements_subscribe",
  `${emoji("bell")} Subscribe to announcements`,
  async ctx => {
    await withTransaction(async tx => {
      const chatId = ctx.chatId;
      const announcementSubscriptionRepo =
        new AnnouncementSubscriptionRepository(tx);

      const announcementSubscription =
        await announcementSubscriptionRepo.getBychatId(chatId);
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
    });
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
  await withTransaction(async tx => {
    await ctx.answerCallbackQuery();

    const chatId = ctx.chatId!;
    const prevMessageId = ctx.session.announcementSubscriptionMessageId;
    if (!prevMessageId) throw new SessionNotFoundError();

    if (ctx.session.selectedFilters.length === 0) {
      const errorMessage = `${emoji("cross_mark")} Please select at least one filter before applying.`;
      await ctx.api.editMessageText(chatId, prevMessageId, errorMessage);
      return;
    }

    const announcementSubscriptionRepo = new AnnouncementSubscriptionRepository(
      tx
    );
    let announcementSubscription =
      await announcementSubscriptionRepo.getBychatId(chatId);
    if (announcementSubscription) {
      await announcementSubscriptionRepo.update(chatId, {
        filters: ctx.session.selectedFilters,
      });
      const updateMessage = `${emoji("check_mark_button")} Your announcement filters have been updated successfully!`;
      await ctx.api.editMessageText(chatId, prevMessageId, updateMessage);
      ctx.session.selectedFilters = [];
      ctx.session.announcementSubscriptionMessageId = null;
      return;
    }

    announcementSubscription = await announcementSubscriptionRepo.create({
      chatId: chatId,
      filters: ctx.session.selectedFilters,
    });

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

    ctx.session.selectedFilters = [];
    ctx.session.announcementSubscriptionMessageId = null;
  });
});

const announcementsUnsubscribeCommand = new Command<BotContext>(
  "announcements_unsubscribe",
  `${emoji("prohibited")} Unsubscribe from announcements`,
  async ctx => {
    await withTransaction(async tx => {
      const chatId = ctx.chatId;
      const announcementSubscriptionRepo =
        new AnnouncementSubscriptionRepository(tx);

      const announcementSubscription =
        await announcementSubscriptionRepo.getBychatId(chatId);
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

      const formattedMsg = joinWithNewlines(MESSAGES.UNSUBSCRIBE_SUCCESS!);
      await announcementSubscriptionRepo.delete(chatId);
      await ctx.reply(formattedMsg.text, {
        entities: formattedMsg.entities,
      });
    });
  }
);

const announcementsShowFilterCommand = new Command<BotContext>(
  "announcements_show_status",
  `${emoji("clipboard")} Show current announcement subscription status`,
  async ctx => {
    const chatId = ctx.chatId;
    const announcementSubscriptionRepo =
      new AnnouncementSubscriptionRepository();
    const announcementSubscription =
      await announcementSubscriptionRepo.getBychatId(chatId);

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
  "announcements_change_filter",
  `${emoji("toolbox")} Change announcement filters`,
  async ctx => {
    await withTransaction(async tx => {
      const chatId = ctx.chatId;
      const announcementSubscriptionRepo =
        new AnnouncementSubscriptionRepository(tx);

      const existingSubscription =
        await announcementSubscriptionRepo.getBychatId(chatId);
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
    });
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
  announcementSubscriptionsCommands,
  announcementsSubscribeCommand,
  announcementsUnsubscribeCommand,
  announcementsShowFilterCommand,
  announcementsChangeFilterCommand,
};
