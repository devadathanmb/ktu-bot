import { ANNOUNCEMENT_FILTER_MAP } from "../../../constants/courses.js";
import { withTransaction } from "../../../db/index.js";
import { AnnouncementSubscriptionRepository } from "../../../db/repositories/AnnouncementSubscriptionRepository.js";
import { ChatNotFoundError } from "../../../errors/index.js";
import { BotContext } from "../../../types/bot.types.js";
import { CommandGroup, Command } from "@grammyjs/commands";
import { Composer } from "grammy";
import { generateFilterKeyboard, generateMessageText } from "./helpers.js";
import { fmt, b, FormattedString } from "@grammyjs/parse-mode";
import ensureChatId from "../../middlewares/ensureChatId.js";
import { combineFormattedDouble } from "../../../utils/combineFormatted.js";
import { createAnnouncementSubscriptionErrorBoundary } from "../shared/errorBoundary.js";
import { emoji } from "@grammyjs/emoji";

// Common messages used throughout the composer
const MESSAGES: Record<string, Array<FormattedString>> = {
  ALREADY_SUBSCRIBED: [
    fmt`${emoji("bell")} You are already subscribed to announcements! Use /announcements_show_status to check your announcement subscription status.`,
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

// Create the subscriptions composer
export const announcementSubscriptions = new Composer<BotContext>();

// Add chatId validation middleware to all handlers in this composer
announcementSubscriptions.use(ensureChatId);

// Create protected composer with error boundary
const protectedComposer = new Composer<BotContext>();
protectedComposer.errorBoundary(createAnnouncementSubscriptionErrorBoundary());

announcementSubscriptions.use(protectedComposer);

// Command: /announcements_subscribe - Subscribe to announcements
const announcementsSubscribeCommand = new Command<BotContext>(
  "announcements_subscribe",
  "🔔 Subscribe to announcements",
  async ctx => {
    await withTransaction(async tx => {
      const chatId = ctx.chatId!;
      const announcementSubscriptionRepo =
        new AnnouncementSubscriptionRepository(tx);

      // Check if user is already subscribed
      let announcementSubscription =
        await announcementSubscriptionRepo.getBychatId(chatId);
      if (announcementSubscription) {
        const formattedMsg = combineFormattedDouble(
          MESSAGES.ALREADY_SUBSCRIBED!
        );
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

// Callbackquery: Handle filter button clicks
// Filter selection callback handler
protectedComposer.callbackQuery(/^announcement_filter_select_/, async ctx => {
  // Answer the callback query
  await ctx.answerCallbackQuery();

  // If previous message ID is not set, throw error
  const prevMessageId = ctx.session.announcementSubscriptionMessageId;
  if (!prevMessageId) throw new ChatNotFoundError();

  const chatId = ctx.chatId!;
  const filter = ctx.callbackQuery.data.replace(
    "announcement_filter_select_",
    ""
  );

  // Check if the filter is valid
  if (!(filter in ANNOUNCEMENT_FILTER_MAP)) {
    const invalidMessage = `${emoji("cross_mark")} Invalid filter selected. Please try again.`;
    await ctx.api.editMessageText(chatId, prevMessageId, invalidMessage);
    return;
  }

  // No need to initialize selectedFilters; always an array

  // Toggle the filter selection
  const filterIndex = ctx.session.selectedFilters.indexOf(filter);
  if (filterIndex === -1) {
    // Add filter if not selected
    ctx.session.selectedFilters.push(filter);
  } else {
    // Remove filter if already selected
    ctx.session.selectedFilters.splice(filterIndex, 1);
  }

  // Update the keyboard and message
  const newKeyboard = generateFilterKeyboard(ctx.session.selectedFilters);
  const newMessageText = generateMessageText(ctx.session.selectedFilters);

  await ctx.api.editMessageText(chatId, prevMessageId, newMessageText.text, {
    entities: newMessageText.entities,
    reply_markup: newKeyboard,
  });
});

// Callbackquery: Handle Apply Filters button
protectedComposer.callbackQuery("announcement_apply_filters", async ctx => {
  await withTransaction(async tx => {
    // Answer the callback query
    await ctx.answerCallbackQuery();

    const chatId = ctx.chatId!;
    const prevMessageId = ctx.session.announcementSubscriptionMessageId;
    if (!prevMessageId) throw new ChatNotFoundError();

    // Check if filters are selected
    if (ctx.session.selectedFilters.length === 0) {
      const errorMessage = `${emoji("cross_mark")} Please select at least one filter before applying.`;
      await ctx.api.editMessageText(chatId, prevMessageId, errorMessage);
      return;
    }

    // Create the announcement subscription with selected filters
    // If announcementSubscription already exists, update instead of create
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
      // Clear session data
      ctx.session.selectedFilters = [];
      ctx.session.announcementSubscriptionMessageId = null;
      return;
    }

    // Create new subscription
    announcementSubscription = await announcementSubscriptionRepo.create({
      chatId: chatId,
      filters: ctx.session.selectedFilters,
    });

    // Create success message
    const selectedFilterNames = ctx.session.selectedFilters.map(
      (filter: string) =>
        ANNOUNCEMENT_FILTER_MAP[filter as keyof typeof ANNOUNCEMENT_FILTER_MAP]!
    );
    const successMessage = combineFormattedDouble([
      fmt`${emoji("check_mark_button")} Successfully subscribed to announcements!`,
      fmt`${b}Your selected filters:${b} ${selectedFilterNames.join(", ")}`,
    ]);

    await ctx.api.editMessageText(chatId, prevMessageId, successMessage.text, {
      entities: successMessage.entities,
    });

    // Clear session data
    ctx.session.selectedFilters = [];
    ctx.session.announcementSubscriptionMessageId = null;
  });
});

// Command: /announcements_unsubscribe - Unsubscribe from announcements
const announcementsUnsubscribeCommand = new Command<BotContext>(
  "announcements_unsubscribe",
  `${emoji("prohibited")} Unsubscribe from announcements`,
  async ctx => {
    await withTransaction(async tx => {
      const chatId = ctx.chatId!;
      const announcementSubscriptionRepo =
        new AnnouncementSubscriptionRepository(tx);

      // Check if subscription exists
      const announcementSubscription =
        await announcementSubscriptionRepo.getBychatId(chatId);
      if (!announcementSubscription) {
        const formattedMsg = combineFormattedDouble(
          MESSAGES.NOT_SUBSCRIBED_WITH_EMOJI!
        );
        await ctx.reply(formattedMsg.text, {
          entities: formattedMsg.entities,
        });
        return;
      }

      // Unsubscribe the user
      const formattedMsg = combineFormattedDouble(
        MESSAGES.UNSUBSCRIBE_SUCCESS!
      );
      await announcementSubscriptionRepo.delete(chatId);
      await ctx.reply(formattedMsg.text, {
        entities: formattedMsg.entities,
      });
    });
  }
);

// Command: /announcements_show_status - Show current subscription status
const announcementsShowFilterCommand = new Command<BotContext>(
  "announcements_show_status",
  `${emoji("clipboard")} Show current announcement subscription status`,
  async ctx => {
    const chatId = ctx.chatId!;
    const announcementSubscriptionRepo =
      new AnnouncementSubscriptionRepository();
    const announcementSubscription =
      await announcementSubscriptionRepo.getBychatId(chatId);

    if (!announcementSubscription) {
      const formattedMsg = combineFormattedDouble(
        MESSAGES.NOT_SUBSCRIBED_WITH_EMOJI!
      );
      await ctx.reply(formattedMsg.text, {
        entities: formattedMsg.entities,
      });
      return;
    }

    // Convert filter codes to readable names
    const filterNames = announcementSubscription.filters.map(
      (filter: string) =>
        ANNOUNCEMENT_FILTER_MAP[
          filter as keyof typeof ANNOUNCEMENT_FILTER_MAP
        ] || filter
    );

    // Create a nicely formatted status message using emoji context
    const filtersList = filterNames
      .map((name: string) => `   • ${name}`)
      .join("\n");
    const statusMessage = combineFormattedDouble([
      fmt`${emoji("check_mark_button")} ${b}Announcement Subscription Status${b}`,
      fmt`${emoji("clipboard")} ${b}Active Filters:${b} ${announcementSubscription.filters.length}`,
      fmt`${emoji("bullseye")} ${b}You are subscribed to:${b}\n${filtersList}`,
    ]);
    const suggestionsMessage = combineFormattedDouble([
      fmt`${emoji("light_bulb")} Use /announcements_change_filter to modify your filters`,
      fmt`${emoji("cross_mark")} Use /announcements_unsubscribe to unsubscribe`,
    ]);

    const combinedMessage = combineFormattedDouble([
      statusMessage,
      suggestionsMessage,
    ]);

    await ctx.reply(combinedMessage.text, {
      entities: combinedMessage.entities,
    });
  }
);

// Command: /announcements_change_filter - Change announcement filters
const announcementsChangeFilterCommand = new Command<BotContext>(
  "announcements_change_filter",
  `${emoji("toolbox")} Change announcement filters`,
  async ctx => {
    await withTransaction(async tx => {
      const chatId = ctx.chatId!;
      const announcementSubscriptionRepo =
        new AnnouncementSubscriptionRepository(tx);

      // Check if user has an existing subscription
      const existingSubscription =
        await announcementSubscriptionRepo.getBychatId(chatId);
      if (!existingSubscription) {
        const formattedMsg = combineFormattedDouble(
          MESSAGES.NOT_SUBSCRIBED_CHANGE_FILTER!
        );
        await ctx.reply(formattedMsg.text, {
          entities: formattedMsg.entities,
        });
        return;
      }

      // Initialize session with current filters
      ctx.session.selectedFilters = existingSubscription.filters || [];

      // Generate keyboard and send message
      const keyboard = generateFilterKeyboard(ctx.session.selectedFilters);
      const messageText = generateMessageText(
        ctx.session.selectedFilters,
        "change"
      );
      const sentMessage = await ctx.reply(messageText.text, {
        entities: messageText.entities,
        reply_markup: keyboard,
      });

      // Store the message ID for later editing
      ctx.session.announcementSubscriptionMessageId = sentMessage.message_id;
    });
  }
);

// Create the announcement subscriptions command group
const announcementSubscriptionsCommands = new CommandGroup<BotContext>();

// Add commands to the group
announcementSubscriptionsCommands
  .add(announcementsSubscribeCommand)
  .add(announcementsUnsubscribeCommand)
  .add(announcementsShowFilterCommand)
  .add(announcementsChangeFilterCommand);

// Hook the command group into the composer
announcementSubscriptions.use(announcementSubscriptionsCommands);

export {
  announcementSubscriptionsCommands,
  announcementsSubscribeCommand,
  announcementsUnsubscribeCommand,
  announcementsShowFilterCommand,
  announcementsChangeFilterCommand,
};
