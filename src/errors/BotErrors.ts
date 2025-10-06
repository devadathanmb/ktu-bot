/**
 * Custom error classes for the bot application
 */

import { emoji } from "@grammyjs/emoji";
import { combineFormattedDouble } from "../utils/formatting.js";
import { fmt } from "@grammyjs/parse-mode";

export class BotError extends Error {
  public readonly userMessage: string;

  constructor(message: string, userMessage?: string) {
    super(message);
    this.name = this.constructor.name;
    this.userMessage = userMessage || message;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class SessionNotFoundError extends BotError {
  constructor(
    message = "Session data not found for the chat",
    userMessage = combineFormattedDouble([
      fmt`Oops.. Session expired ${emoji("alarm_clock")}`,
      fmt`Please try the corresponding command again.`,
    ])
  ) {
    super(message, userMessage.text);
  }
}

export class KTUAPIError extends BotError {
  public readonly statusCode?: number;
  public readonly url?: string;
  public readonly serviceName: string;

  constructor(
    serviceName: string,
    message: string,
    userMessage: string,
    statusCode?: number,
    url?: string
  ) {
    super(message, userMessage);
    this.serviceName = serviceName;
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
    if (url !== undefined) {
      this.url = url;
    }
  }
}
