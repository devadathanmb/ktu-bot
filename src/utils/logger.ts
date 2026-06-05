import pino from "pino";
import { LogConfig } from "../configs/logging.js";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "token",
  "apikey",
  "api_key",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sanitizeLogValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(item => sanitizeLogValue(item));
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      key,
      SENSITIVE_KEYS.has(key.toLowerCase())
        ? REDACTED
        : sanitizeLogValue(nestedValue),
    ])
  );
}

function serializeError(error: Error): unknown {
  return sanitizeLogValue(pino.stdSerializers.err(error));
}

const loggerOptions: pino.LoggerOptions = {
  level: LogConfig.LOG_LEVEL,

  serializers: {
    err: serializeError,
    error: serializeError,
  },

  redact: {
    paths: [
      "password",
      "token",
      "apiKey",
      "api_key",
      "authorization",
      "cookie",
      "*.password",
      "*.token",
      "*.apiKey",
      "*.api_key",
      "*.authorization",
      "*.cookie",
      "*.headers.authorization",
      "*.headers.cookie",
      "*.options.body",
      "*.options.headers.authorization",
      "*.options.headers.cookie",
      "err.options.body",
      "err.options.headers.authorization",
      "err.options.headers.cookie",
      "error.options.body",
      "error.options.headers.authorization",
      "error.options.headers.cookie",
    ],
    censor: REDACTED,
  },
};

let logger: pino.Logger;

if (LogConfig.NODE_ENV === "production") {
  // JSON output — machine-parseable, no formatting overhead
  logger = pino(loggerOptions);
} else {
  // Pretty-printed local dev logs (in-process stream to avoid thread-stream/tsx issues)
  const pinoPretty = await import("pino-pretty");
  logger = pino(
    loggerOptions,
    pinoPretty.default({
      colorize: true,
      translateTime: "SYS:HH:MM:ss",
      ignore: "pid,hostname",
    })
  );
}

export default logger;
