import type { BeforeErrorHook } from "got";

/**
 * Got attaches the full request `options` and `timings` to its errors.
 * In got v12+, `error.options` is enumerable, so loggers like pino serialize
 * the entire configuration object (headers, body, agents, etc.) causing
 * massive, unreadable log output.
 *
 * This hook makes those properties non-enumerable so they don't bloat logs,
 * while keeping them accessible for debugging if needed.
 */
export const cleanGotError: BeforeErrorHook = error => {
  Object.defineProperty(error, "options", { enumerable: false });
  Object.defineProperty(error, "timings", { enumerable: false });

  if (error.response) {
    Object.defineProperty(error.response, "request", { enumerable: false });
    Object.defineProperty(error.response, "rawBody", { enumerable: false });
    Object.defineProperty(error.response, "_events", { enumerable: false });
    Object.defineProperty(error.response, "_readableState", {
      enumerable: false,
    });
    Object.defineProperty(error.response, "_writableState", {
      enumerable: false,
    });
  }

  return error;
};
