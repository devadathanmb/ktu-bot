import { problem } from "../utils/message-style.js";

export class BotError extends Error {
  public readonly userMessage: string;

  constructor(message: string, userMessage?: string, options?: ErrorOptions) {
    super(message, options);
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
    userMessage = problem(
      "This session has expired.",
      "Run the command again to continue, or use /help to see all commands."
    ).text
  ) {
    super(message, userMessage);
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
    url?: string,
    cause?: Error
  ) {
    super(message, userMessage, cause ? { cause } : undefined);
    this.serviceName = serviceName;
    if (statusCode !== undefined) {
      this.statusCode = statusCode;
    }
    if (url !== undefined) {
      this.url = url;
    }
  }
}
