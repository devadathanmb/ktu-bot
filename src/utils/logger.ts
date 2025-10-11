import pino from "pino";
import { LogConfig } from "../configs/logging.js";

const logger = pino({
  level: LogConfig.LOG_LEVEL,

  // This is helpful when you want to log an error object with context
  // Like: logger.error({ err: new Error("boom"), context: "data" }, "msg");
  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },

  // Redact sensitive information from logs
  redact: {
    paths: [
      "password",
      "token",
      "apiKey",
      "api_key",
      "authorization",
      "cookie",
    ],
    censor: "[REDACTED]",
  },

  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:HH:MM:ss",
      ignore: "pid,hostname",
    },
  },
});

export default logger;
