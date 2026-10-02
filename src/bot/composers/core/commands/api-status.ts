import { BotContext } from "../../../../types/bot.types.js";
import { Command } from "@grammyjs/commands";
import { getApiStatus } from "../../../../api/services/betteruptime/index.js";
import { editMessageSafely } from "../../../../utils/bot.js";
import { InlineKeyboard } from "grammy";
import {
  BETTER_UPTIME_API,
  UPTIME_ROBOT_API,
} from "../../../../constants/api.js";
import { fmt, b } from "@grammyjs/parse-mode";
import {
  blocks,
  heading,
  ICON,
  lines,
  problem,
} from "../../../../utils/message-style.js";
import { emoji } from "@grammyjs/emoji";
import { HandledBotError } from "../../../../errors/handled-bot-error.js";
import { coreCommand } from "./registry.js";

const metadata = coreCommand("serverstatus");

export const ktuAPIStatusCommand = new Command<BotContext>(
  metadata.name,
  metadata.description,
  async ctx => {
    const loadingMessage = fmt`${ICON.loading} Checking KTU services…`;

    const keyboard = new InlineKeyboard()
      .url(
        `${emoji("bar_chart")} UptimeRobot status page`,
        UPTIME_ROBOT_API.STATS_PAGE
      )
      .row()
      .url(
        `${emoji("rocket")} Better Uptime status page`,
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
      const apiStatusResponse = await getApiStatus();

      const title = heading(
        emoji("globe_with_meridians"),
        "KTU service status"
      );

      const monitorMessages = apiStatusResponse.monitors.map(monitor => {
        const statusEmoji =
          monitor.status === "up" ? emoji("green_circle") : emoji("red_circle");
        const statusText = monitor.status === "up" ? "Up" : "Down";

        return lines([
          fmt`${statusEmoji} ${b}${monitor.name}${b}`,
          fmt`${statusText}, responding in ${Math.round(monitor.responseTime)} ms`,
        ]);
      });

      const message = blocks([title, ...monitorMessages]);

      await editMessageSafely(ctx, statusMessage.message_id, message.text, {
        entities: message.entities,
        reply_markup: keyboard,
        link_preview_options: { is_disabled: true },
      });
    } catch (error) {
      const errorMessage = problem(
        "Couldn’t check KTU services.",
        "Please try again in a few minutes."
      );

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
