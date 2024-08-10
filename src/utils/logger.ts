import { createLogger, format, transports } from 'winston';
import * as path from 'path';

const logDirectory = '/var/log/ktu-bot';

const winston = createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  format: format.combine(
    format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    format.printf(({ timestamp, level, message, service }) => {
      return `${timestamp} [${level}] [${service}] : ${message}`;
    })
  ),
  transports: [
    new transports.Console({
      format: format.combine(
        format.colorize(),
        format.timestamp(),
        format.printf(({ timestamp, level, message, service }) => {
          return `${timestamp} [${level}] [${service}] : ${message}`;
        })
      ),
    }),
    new transports.File({
      filename: path.join(logDirectory, 'bot.log'),
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, service }) => {
          return `${timestamp} [${level}] [${service}] : ${message}`;
        })
      ),
    }),
    new transports.File({
      level: 'error',
      filename: path.join(logDirectory, 'error.log'),
      format: format.combine(
        format.timestamp(),
        format.printf(({ timestamp, level, message, service }) => {
          return `${timestamp} [${level}] [${service}] : ${message}`;
        })
      ),
    }),
  ],
});

class Logger {
  private static instances: Map<string, Logger> = new Map();
  private service: string;

  private constructor(service: string) {
    this.service = service;
  }

  public static getLogger(service: string): Logger {
    if (!service) {
      service = "LOGGER";
    }
    if (!this.instances.has(service)) {
      this.instances.set(service, new Logger(service));
    }
    return this.instances.get(service)!;
  }

  private log(level: string, message: string) {
    winston.log(level, message, { service: this.service });
  }

  debug(message: string) {
    this.log('debug', `${message}`);
  }

  warn(message: string) {
    this.log('warn', `${message}`);
  }

  error(message: string) {
    this.log('error', `${message}`);
  }

  info(message: string) {
    this.log('info', `${message}`);
  }

  warning(message: string) {
    this.log('warn', `${message}`);
  }

  notice(message: string) {
    this.log('info', `${message}`);
  }

  crit(message: string) {
    this.log('error', `${message}`);
  }
}

export default Logger;
