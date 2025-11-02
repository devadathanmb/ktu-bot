import { Counter, Histogram, Registry } from "prom-client";

/**
 * Bot-specific Prometheus metrics definitions
 * Centralized location for all bot metrics to ensure consistency
 */

export interface BotMetrics {
  // Message processing metrics
  messagesReceivedTotal: Counter;
  messagesProcessedTotal: Counter;
  messageProcessingDuration: Histogram;

  // Command metrics
  commandsTotal: Counter;
  commandDuration: Histogram;

  // Inline query metrics
  inlineQueriesTotal: Counter;
  inlineQueryDuration: Histogram;

  // Telegram API metrics
  telegramApiCallsTotal: Counter;
  telegramApiErrorsTotal: Counter;
  telegramApiRequestDuration: Histogram;

  // Error metrics
  botErrorsTotal: Counter;
}

/**
 * Creates all bot-specific metrics and registers them
 *
 * @param registry - Prometheus registry to register metrics with
 * @returns Object containing all bot metrics
 */
export function createBotMetrics(registry: Registry): BotMetrics {
  return {
    // Message processing metrics
    messagesReceivedTotal: new Counter({
      name: "telegram_bot_messages_received_total",
      help: "Total number of messages received by the bot",
      labelNames: ["type"], // text, photo, document, etc.
      registers: [registry],
    }),

    messagesProcessedTotal: new Counter({
      name: "telegram_bot_messages_processed_total",
      help: "Total number of messages successfully processed",
      labelNames: ["type"],
      registers: [registry],
    }),

    messageProcessingDuration: new Histogram({
      name: "telegram_bot_message_processing_duration_milliseconds",
      help: "Duration of message processing in milliseconds",
      labelNames: ["type"],
      buckets: [1, 5, 10, 50, 100, 500, 1000, 2000, 5000],
      registers: [registry],
    }),

    // Command metrics
    commandsTotal: new Counter({
      name: "telegram_bot_commands_total",
      help: "Total number of commands executed",
      labelNames: ["command"], // subscribe, unsubscribe, help, etc.
      registers: [registry],
    }),

    commandDuration: new Histogram({
      name: "telegram_bot_command_duration_milliseconds",
      help: "Duration of command execution in milliseconds",
      labelNames: ["command"],
      buckets: [10, 50, 100, 500, 1000, 2000, 5000, 10000],
      registers: [registry],
    }),

    // Inline query metrics
    inlineQueriesTotal: new Counter({
      name: "telegram_bot_inline_queries_total",
      help: "Total number of inline queries received",
      labelNames: ["query_type"], // announcement, timetable, calendar, etc.
      registers: [registry],
    }),

    inlineQueryDuration: new Histogram({
      name: "telegram_bot_inline_query_duration_milliseconds",
      help: "Duration of inline query processing in milliseconds",
      labelNames: ["query_type"],
      buckets: [10, 50, 100, 500, 1000, 2000, 5000],
      registers: [registry],
    }),

    // Telegram API metrics
    telegramApiCallsTotal: new Counter({
      name: "telegram_api_calls_total",
      help: "Total Telegram API calls made",
      labelNames: ["method", "status"], // method: sendMessage, editMessage, etc; status: success, error
      registers: [registry],
    }),

    telegramApiErrorsTotal: new Counter({
      name: "telegram_api_errors_total",
      help: "Total Telegram API errors",
      labelNames: ["error_code"],
      registers: [registry],
    }),

    telegramApiRequestDuration: new Histogram({
      name: "telegram_api_request_duration_milliseconds",
      help: "Duration of Telegram API requests in milliseconds",
      labelNames: ["method"],
      buckets: [10, 50, 100, 500, 1000, 2000, 5000, 10000],
      registers: [registry],
    }),

    // Error metrics
    botErrorsTotal: new Counter({
      name: "telegram_bot_errors_total",
      help: "Total bot errors",
      labelNames: ["error_type", "handled_by"], // handled_by: composer-error-boundary or global
      registers: [registry],
    }),
  };
}
