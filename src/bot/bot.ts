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
import { announcementSubscriptions } from "./composers/announcementSubscriptions/composer.js";
import { initSession } from "./middlewares/initSession.js";
import logging from "./middlewares/logging.js";
import { globalErrorHandler } from "./handlers/globalError.js";
import { unknownCommandHandler } from "./handlers/unknownCommand.js";
import { unhandled } from "./composers/unhandled/composer.js";
import { announcementsLookup } from "./composers/lookups/announcements/composer.js";
import { timetableLookup } from "./composers/lookups/exam-timetable/composer.js";
import { calendarLookup } from "./composers/lookups/academic-calendar/composer.js";
import { inlineQuery } from "./composers/inlineQuery/composer.js";
import { inlineResultMessage } from "./composers/inlineResultMessage/composer.js";
import { sequentialize } from "@grammyjs/runner";
import { chatMemeberHandler } from "./handlers/chatMemeber.js";
import { DEPRECATED_COMMANDS_LIST } from "../constants/bot.js";
import { deprecatedCommandHandler } from "./handlers/deprecated.js";
import trackChatId from "./middlewares/trackChatId.js";
import { limit } from "@grammyjs/ratelimiter";
import { rateLimitExceededHandler } from "./handlers/ratelimit.js";

// Sesion key generator function
function getSessionKey(ctx: Omit<Context, "session">) {
  return ctx.chat?.id.toString();
}

export function createBot(): Bot<BotContext> {
  // Create the bot instance
  const bot = new Bot<BotContext>(BotConfig.BOT_TOKEN);

  // Set up middlewares:
  // Logging should be the first middleware in the stack
  // This is to track response times and other useful info
  bot.use(logging);

  // Other middlewares:
  // Long polling only middlewares:
  if (BotConfig.IS_LONG_POLLING_DEPLOYMENT) {
    // Rate limiting middleware
    bot.use(
      limit({
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onLimitExceeded: rateLimitExceededHandler,
      })
    );

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

  // Handle inline result messages before unhandled
  bot.use(inlineResultMessage);

  // Unhandled stuff — Should remain at the end
  bot.use(unhandled);

  // Global bot error handler
  bot.catch(globalErrorHandler);

  return bot;
}
