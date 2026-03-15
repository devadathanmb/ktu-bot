import {
  Bot,
  Context,
  Enhance,
  enhanceStorage,
  MemorySessionStorage,
  session,
} from "grammy";
import { BotConfig } from "../configs/bot.js";
import { botCommands } from "./commands/index.js";
import { BotContext, SessionData } from "../types/bot.types.js";
import { commandNotFound, commands } from "@grammyjs/commands";
import { emojiParser } from "@grammyjs/emoji";
import { hydrate } from "@grammyjs/hydrate";
import { announcementSubscriptions } from "./composers/announcement-subscriptions/composer.js";
import { initSession } from "./middlewares/init-session.js";
import logging from "./middlewares/logging.js";
import { globalErrorHandler } from "./handlers/global-error.js";
import { unknownCommandHandler } from "./handlers/unknown-command.js";
import { unhandled } from "./composers/unhandled/composer.js";
import { announcementsLookup } from "./composers/lookups/announcements/composer.js";
import { timetableLookup } from "./composers/lookups/exam-timetable/composer.js";
import { calendarLookup } from "./composers/lookups/academic-calendar/composer.js";
import { inlineQuery } from "./composers/inline-query/composer.js";
import { sequentialize } from "@grammyjs/runner";
import { chatMemeberHandler } from "./handlers/chat-member.js";
import { DEPRECATED_COMMANDS_LIST } from "../constants/bot.js";
import { deprecatedCommandHandler } from "./handlers/deprecated.js";
import trackChatId from "./middlewares/track-chat-id.js";
import { createMetricsMiddleware } from "./middlewares/metrics.js";
import type { BotMetrics } from "../metrics/definitions.js";

// Session key generator function
function getSessionKey(ctx: Omit<Context, "session">) {
  return ctx.chat?.id.toString();
}

/**
 * Creates a bot without metrics instrumentation.
 * Use this for background workers that don't need observability.
 */
export function createBot(): Bot<BotContext> {
  const bot = new Bot<BotContext>(BotConfig.BOT_TOKEN);
  configureBot(bot);
  bot.catch(error => globalErrorHandler(error, undefined));
  return bot;
}

/**
 * Creates a bot with metrics instrumentation.
 * Use this for the main bot application to enable Prometheus metrics.
 */
export function createBotWithMetrics(metrics: BotMetrics): Bot<BotContext> {
  const bot = new Bot<BotContext>(BotConfig.BOT_TOKEN);
  bot.use(createMetricsMiddleware(metrics));
  configureBot(bot);
  bot.catch(error => globalErrorHandler(error, metrics));
  return bot;
}

/**
 * Internal: Configures common bot middleware and handlers.
 */
function configureBot(bot: Bot<BotContext>): void {
  // Logging should be the first middleware in the stack
  // This is to track response times and other useful info
  bot.use(logging);

  // Other middlewares:
  // Long polling only middlewares:
  if (BotConfig.IS_LONG_POLLING_DEPLOYMENT) {
    // Rate limiting middleware
    // bot.use(
    //   limit({
    //     // eslint-disable-next-line @typescript-eslint/no-misused-promises
    //     onLimitExceeded: rateLimitExceededHandler,
    //   })
    // );

    // Sequentialize middleware to process updates from the same chat one by one
    // This prevents race conditions
    bot.use(sequentialize(getSessionKey));
  }

  bot.use(
    session({
      initial: initSession,
      storage: enhanceStorage({
        storage: new MemorySessionStorage<Enhance<SessionData>>(),
        millisecondsToLive: BotConfig.BOT_SESSION_DATA_TTL,
      }),
    })
  );
  bot.use(trackChatId);
  bot.use(hydrate());
  bot.use(emojiParser());
  bot.use(commands());

  // Handle inline queries first, before other composers with chat requirements
  bot.use(inlineQuery);

  // Handle my_chat_member updates
  bot.on("my_chat_member", chatMemeberHandler);

  // Deprecated features
  bot.command(DEPRECATED_COMMANDS_LIST, deprecatedCommandHandler);

  // Composer middlewares that require chat context
  bot.use(announcementSubscriptions);
  bot.use(announcementsLookup);
  bot.use(timetableLookup);
  bot.use(calendarLookup);

  // Command group middleware
  bot.use(botCommands);

  // Handle unknown commands
  bot.filter(commandNotFound(botCommands)).use(unknownCommandHandler);

  // Unhandled stuff — Should remain at the end
  bot.use(unhandled);
}
