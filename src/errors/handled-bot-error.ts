export class HandledBotError extends Error {
  constructor(
    public readonly originalError: Error,
    public readonly handledBy: string,
    public readonly userNotified: boolean = true,
    public readonly cleanupActions: string[] = []
  ) {
    super(originalError.message);
    this.name = "HandledBotError";
    if (originalError.stack) {
      this.stack = originalError.stack;
    }
  }
}
