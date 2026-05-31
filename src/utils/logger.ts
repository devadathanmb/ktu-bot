import pino from "pino";
import pinoPretty from "pino-pretty";
import { LogConfig } from "../configs/logging.js";

const loggerOptions: pino.LoggerOptions = {
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
};

const logger = pino(
  loggerOptions,
  pinoPretty({
    colorize: true,
    translateTime: "SYS:HH:MM:ss",
    ignore: "pid,hostname",
  })
);

export default logger;
