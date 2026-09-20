import { Counter, Histogram, Registry } from "prom-client";

export interface BotMetrics {
  messagesReceivedTotal: Counter;
  messagesProcessedTotal: Counter;
  messageProcessingDuration: Histogram;

  commandsTotal: Counter;
  commandDuration: Histogram;

  inlineQueriesTotal: Counter;
  inlineQueryDuration: Histogram;

  botErrorsTotal: Counter;
}

export function createBotMetrics(registry: Registry): BotMetrics {
  return {
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

    botErrorsTotal: new Counter({
      name: "telegram_bot_errors_total",
      help: "Total bot errors",
      labelNames: ["error_type", "handled_by"], // handled_by: composer-error-boundary or global
      registers: [registry],
    }),
  };
}
