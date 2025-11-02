/**
 * Wraps an error that has already been handled by an error boundary
 * Carries metadata about what handling was performed to prevent duplicate responses
 */
export class HandledBotError extends Error {
  constructor(
    public readonly originalError: Error,
    public readonly handledBy: string,
    public readonly userNotified: boolean = true,
    public readonly cleanupActions: string[] = []
  ) {
    super(originalError.message);
    this.name = "HandledBotError";
    // Preserve original stack trace for debugging
    if (originalError.stack) {
      this.stack = originalError.stack;
    }
  }
}
