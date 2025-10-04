/**
 * Custom error classes for the bot application
 */

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

export class ChatIdNotFoundError extends BotError {
  constructor(
    message = "Chat ID not found",
    userMessage = "Chat information not available."
  ) {
    super(message, userMessage);
  }
}

export class ChatNotFoundError extends BotError {
  constructor(
    message = "Chat not found",
    userMessage = "Chat not found. Please try again."
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
