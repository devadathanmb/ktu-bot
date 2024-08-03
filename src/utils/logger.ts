import { createLogger, format, transports } from "winston";
import * as path from "path";

const logDirectory = "/var/log/ktu-bot";

const winston = createLogger({
  level: process.env.LOG_LEVEL || "debug",
  format: format.combine(
    format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }), // Set the timestamp format
    format.printf(({ timestamp, level, message }) => {
      return `${timestamp} [${level}]: ${message}`;
    })
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
    }),
    new transports.File({
      level: "info",
      filename: path.join(logDirectory, "info.log"),
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
    }),
    new transports.File({
      level: "error",
      filename: path.join(logDirectory, "error.log"),
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message }) => {
          return `${timestamp} [${level}]: ${message}`;
        })
      ),
    }),
  ],
});

class Logger {
  service: string = "";
  constructor(service: string) {
    this.service = service;
  }

  debug(message: string) {
    winston.debug(`[${this.service}] ${message}`);
  }

  warn(message: string) {
    winston.warn(`[${this.service}] ${message}`);
  }

  error(message: string) {
    winston.error(`[${this.service}] ${message}`);
  }

  info(message: string) {
    winston.info(`[${this.service}] ${message}`);
  }

  warning(message: string) {
    winston.warn(`[${this.service}] ${message}`);
  }

  notice(message: string) {
    winston.info(`[${this.service}] ${message}`);
  }

  crit(message: string) {
    winston.crit(`[${this.service}] ${message}`);
  }
}

export default Logger;
