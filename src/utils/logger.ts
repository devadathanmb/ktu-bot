import pino from "pino";
import { LogConfig } from "../configs/logging.js";

const logger = pino({
  level: LogConfig.LOG_LEVEL,
  transport: {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname",
      singleLine: false,
      messageFormat: "{msg}",
    },
  },
});

export default logger;
