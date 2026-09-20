import { HTTPError, RequestError } from "got";
import { ZodError } from "zod";
import { KTUAPIError } from "../../../errors/bot-errors.js";
import { TokenSolverError } from "../../token-solver.js";

function isTokenSolverFailure(error: unknown): boolean {
  let current: unknown = error;
  while (current instanceof Error) {
    if (current instanceof TokenSolverError) return true;
    current = current.cause;
  }
  return false;
}

/**
 * Translates failures from KTU API services into KTUAPIError with safe user
 * messages. KTU-only: other services must not use this boundary or their
 * outages get mislabeled as KTU failures.
 *
 * Translation never logs; the bot/worker handling boundary owns logging.
 * Failures this mapper does not recognize — including token-solver outages,
 * which travel through got as RequestError — are rethrown untouched.
 */
export function withKtuErrorMapper<TArgs extends unknown[], TReturn>(
  serviceName: string,
  serviceFunction: (...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await serviceFunction(...args);
    } catch (error: unknown) {
      if (isTokenSolverFailure(error)) throw error;

      // Handle HTTP errors from got
      if (error instanceof HTTPError) {
        const statusCode = error.response.statusCode;
        const url = error.response.requestUrl?.toString();

        // Throw KTUAPIError with specific user messages for different status codes
        switch (statusCode) {
          case 429:
            throw new KTUAPIError(
              serviceName,
              `KTU API rate limited`,
              `KTU API is busy. Please try again after sometime.`,
              statusCode,
              url,
              error
            );
          case 403:
            throw new KTUAPIError(
              serviceName,
              `KTU API access denied`,
              `Access denied to KTU API. Please try again later.`,
              statusCode,
              url,
              error
            );
          case 500:
            throw new KTUAPIError(
              serviceName,
              `KTU API internal server error`,
              `KTU API is currently unavailable. Please try again later.`,
              statusCode,
              url,
              error
            );
          case 404:
            throw new KTUAPIError(
              serviceName,
              `Data not found on KTU API`,
              `Requested data not found. Please try again.`,
              statusCode,
              url,
              error
            );
          default:
            throw new KTUAPIError(
              serviceName,
              `KTU API error`,
              `KTU API is currently having issues. Please try again later.`,
              statusCode,
              url,
              error
            );
        }
      }

      // Handle request errors from got (network issues, timeouts, etc.)
      if (error instanceof RequestError) {
        const url = error.request?.requestUrl?.toString();

        throw new KTUAPIError(
          serviceName,
          `Network error: ${error.message}`,
          `Unable to connect to KTU API. Please try again later.`,
          undefined,
          url,
          error
        );
      }

      // Handle Zod validation errors (invalid API response format)
      if (error instanceof ZodError) {
        throw new KTUAPIError(
          serviceName,
          `API response validation failed: ${error.message}`,
          `The API returned data in an unexpected format. Please try again later.`,
          undefined,
          undefined,
          error
        );
      }

      // If the error is not handled above, re-throw
      throw error;
    }
  };
}
