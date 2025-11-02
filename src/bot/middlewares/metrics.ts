import { BotContext } from "../../types/bot.types.js";
import { NextFunction } from "grammy";
import { BotMetrics } from "../../metrics/definitions.js";
import { getMessageType, getInlineQueryType } from "../../utils/bot.js";

/**
 * Factory function to create metrics middleware
 * Tracks messages, commands, inline queries, and processing duration
 * Error tracking happens centrally in the global error handler
 *
 * @param metrics - BotMetrics instance containing all metric collectors
 * @returns Middleware function
 */
export function createMetricsMiddleware(metrics: BotMetrics) {
  return async function metricsMiddleware(
    ctx: BotContext,
    next: NextFunction
  ): Promise<void> {
    const start = Date.now();

    // Track messages received
    if (ctx.message) {
      const messageType = getMessageType(ctx.message);
      metrics.messagesReceivedTotal.inc({ type: messageType });
    }

    // Track inline queries
    if (ctx.inlineQuery) {
      const queryType = getInlineQueryType(ctx.inlineQuery.query);
      metrics.inlineQueriesTotal.inc({ query_type: queryType });
    }

    // Process the update - errors propagate naturally to global error handler
    await next();

    // Success path - track completed processing
    if (ctx.message) {
      const messageType = getMessageType(ctx.message);
      metrics.messagesProcessedTotal.inc({ type: messageType });

      const duration = Date.now() - start; // Duration in milliseconds
      metrics.messageProcessingDuration.observe(
        { type: messageType },
        duration
      );

      // Track command execution if it's a command
      const messageText = ctx.message.text;
      if (messageText && messageText.startsWith("/")) {
        const commandPart = messageText.split(" ")[0];
        if (commandPart) {
          const command = commandPart.split("@")[0]; // Remove bot username if present
          metrics.commandsTotal.inc({ command });
          metrics.commandDuration.observe({ command }, duration);
        }
      }
    }

    // Track inline query processing
    if (ctx.inlineQuery) {
      const queryType = getInlineQueryType(ctx.inlineQuery.query);
      const duration = Date.now() - start; // Duration in milliseconds
      metrics.inlineQueryDuration.observe({ query_type: queryType }, duration);
    }
  };
}
