import pino from "pino";
import { LogConfig } from "../configs/logging.js";
import {
  LOG_REDACT_PATHS,
  REDACTED,
  sanitizeLogArguments,
  serializeError,
} from "./log-sanitizer.js";

const loggerOptions: pino.LoggerOptions = {
  level: LogConfig.LOG_LEVEL,

  hooks: {
    logMethod(inputArgs, method) {
      method.apply(this, sanitizeLogArguments(inputArgs));
    },
  },

  serializers: {
    err: serializeError,
    error: serializeError,
  },

  redact: {
    paths: LOG_REDACT_PATHS,
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
