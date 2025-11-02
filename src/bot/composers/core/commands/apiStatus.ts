import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { getBetterUptimeApiStatus } from "../../../../api/services/index.js";
import { editMessageSafely } from "../../../../utils/bot.js";
import { InlineKeyboard } from "grammy";
import {
  BETTER_UPTIME_API,
  UPTIME_ROBOT_API,
} from "../../../../constants/api.js";
import { fmt, b } from "@grammyjs/parse-mode";
import { joinWithNewlines } from "../../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";
import { HandledBotError } from "../../../../errors/HandledBotError.js";

export const ktuAPIStatusCommand = new Command<BotContext>(
  "serverstatus",
  `${emoji("globe_showing_asia_australia")} Check the KTU services status`,
  async ctx => {
    const loadingMessage = fmt`${emoji("hourglass_not_done")} Checking KTU services status...`;

    // Keyboard with monitor page links
    const keyboard = new InlineKeyboard()
      .url(
        `${emoji("bar_chart")} View Monitor Page (Uptimerobot)`,
        UPTIME_ROBOT_API.STATS_PAGE
      )
      .row()
      .url(
        `${emoji("rocket")} View Monitor Page (Better Uptime)`,
        BETTER_UPTIME_API.STATS_PAGE
      );

    // Send loading message with hidden dummy button to allow editing with buttons later
    const statusMessage = await ctx.reply(loadingMessage.text, {
      entities: loadingMessage.entities,
      reply_markup: new InlineKeyboard().url(
        "‎",
        "https://www.youtube.com/watch?v=xvFZjo5PgG0" // For the people who are too fast
      ),
      link_preview_options: { is_disabled: true },
    });

    try {
      const apiStatusResponse = await getBetterUptimeApiStatus();

      // Build status message for all monitors
      const title = fmt`${emoji("globe_with_meridians")} ${b}KTU Services Status${b}`;

      const monitorMessages = apiStatusResponse.monitors.map(monitor => {
        const statusEmoji =
          monitor.status === "up" ? emoji("green_circle") : emoji("red_circle");
        const statusText = monitor.status.toUpperCase();

        const name = fmt`${b}${monitor.name}${b}`;
        const status = fmt`  ${statusEmoji} ${b}Status:${b} ${statusText}`;
        const responseTime = fmt`  ${emoji("high_voltage")} ${b}Response Time:${b} ${monitor.responseTime.toFixed(2)}ms`;

        return joinWithNewlines([name, status, responseTime], 1);
      });

      const message = joinWithNewlines([title, ...monitorMessages], 2);

      await editMessageSafely(ctx, statusMessage.message_id, message.text, {
        entities: message.entities,
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      // Send error message to user
      const errorDescription = fmt`${emoji("frowning_face")} Failed to fetch API status. Please try again later.`;
      const errorMessage = joinWithNewlines([errorDescription], 2);

      await editMessageSafely(
        ctx,
        statusMessage.message_id,
        errorMessage.text,
        {
          entities: errorMessage.entities,
          reply_markup: keyboard,
          link_preview_options: { is_disabled: true },
        }
      );

      // Wrap and re-throw for central error tracking
      const originalError =
        error instanceof Error ? error : new Error(String(error));
      throw new HandledBotError(
        originalError,
        "api-status-command",
        true, // user was notified
        ["edited-message-with-error"]
      );
    }
  }
);
