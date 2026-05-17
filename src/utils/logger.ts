import pino from "pino";
import { LogConfig } from "../configs/logging.js";

const logger = pino({
  level: LogConfig.LOG_LEVEL,

  serializers: {
    err: pino.stdSerializers.err,
    error: pino.stdSerializers.err,
  },

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
