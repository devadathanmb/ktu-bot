import { BotContext } from "../../types/bot.types.js";
import { NextFunction } from "grammy";
import { BotMetrics } from "../../metrics/definitions.js";
import { getMessageType, getInlineQueryType } from "../../utils/bot.js";

export function createMetricsMiddleware(metrics: BotMetrics) {
  return async function metricsMiddleware(
    ctx: BotContext,
    next: NextFunction
  ): Promise<void> {
    const start = Date.now();

    if (ctx.message) {
      const messageType = getMessageType(ctx.message);
      metrics.messagesReceivedTotal.inc({ type: messageType });
    }

    if (ctx.inlineQuery) {
      const queryType = getInlineQueryType(ctx.inlineQuery.query);
      metrics.inlineQueriesTotal.inc({ query_type: queryType });
    }

    await next();

    if (ctx.message) {
      const messageType = getMessageType(ctx.message);
      metrics.messagesProcessedTotal.inc({ type: messageType });

      const duration = Date.now() - start;
      metrics.messageProcessingDuration.observe(
        { type: messageType },
        duration
      );

      const messageText = ctx.message.text;
      if (messageText && messageText.startsWith("/")) {
        const commandPart = messageText.split(" ")[0];
        if (commandPart) {
          const command = commandPart.split("@")[0];
          metrics.commandsTotal.inc({ command });
          metrics.commandDuration.observe({ command }, duration);
        }
      }
    }

    if (ctx.inlineQuery) {
      const queryType = getInlineQueryType(ctx.inlineQuery.query);
      const duration = Date.now() - start;
      metrics.inlineQueryDuration.observe({ query_type: queryType }, duration);
    }
  };
}
