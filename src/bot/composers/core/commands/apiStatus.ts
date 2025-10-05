import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { getApiStatus } from "../../../../api/services/index.js";
import { editMessageSafely } from "../../../../utils/bot.js";
import { InlineKeyboard } from "grammy";
import { UPTIME_ROBOT_API } from "../../../../constants/api.js";
import { fmt, b } from "@grammyjs/parse-mode";
import { combineFormattedDouble } from "../../../../utils/formatting.js";
import { emoji } from "@grammyjs/emoji";

export const ktuAPIStatusCommand = new Command<BotContext>(
  "serverstatus",
  `${emoji("globe_showing_asia_australia")} Check the KTU API server status`,
  async ctx => {
    const loadingMessage = fmt`${emoji("hourglass_not_done")} Checking KTU API server status...`;

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
      const apiStatus = await getApiStatus();

      // Format status message
      const statusEmoji =
        apiStatus.status === "up" ? emoji("green_circle") : emoji("red_circle");
      const statusText =
        apiStatus.status.charAt(0).toUpperCase() + apiStatus.status.slice(1);

      const title = fmt`${emoji("globe_with_meridians")} ${b}KTU API Server Status${b}`;
      const status = fmt`${statusEmoji} ${b}Status:${b} ${statusText}`;
      const responseTime = fmt`${emoji("high_voltage")} ${b}Response Time:${b} ${apiStatus.responseTime}ms`;
      const message = combineFormattedDouble([title, status, responseTime]);

      const keyboard = new InlineKeyboard().url(
        `${emoji("bar_chart")} View Monitor Page`,
        UPTIME_ROBOT_API.STATS_PAGE
      );

      await editMessageSafely(ctx, statusMessage.message_id, message.text, {
        entities: message.entities,
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });
    } catch {
      const errorDescription = fmt`${emoji("frowning_face")} Failed to fetch API status. Please try again later.`;
      const errorMessage = combineFormattedDouble([errorDescription]);

      await editMessageSafely(
        ctx,
        statusMessage.message_id,
        errorMessage.text,
        {
          entities: errorMessage.entities,
          link_preview_options: { is_disabled: true },
        }
      );
    }
  }
);
