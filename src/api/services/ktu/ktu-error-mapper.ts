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

      if (error instanceof HTTPError) {
        const statusCode = error.response.statusCode;
        const url = error.response.requestUrl?.toString();

        switch (statusCode) {
          case 429:
            throw new KTUAPIError(
              serviceName,
              `KTU API rate limited`,
              `KTU is receiving too many requests. Please wait a bit and try again.`,
              statusCode,
              url,
              error
            );
          case 403:
            throw new KTUAPIError(
              serviceName,
              `KTU API access denied`,
              `KTU is blocking this request. Please try again later.`,
              statusCode,
              url,
              error
            );
          case 500:
            throw new KTUAPIError(
              serviceName,
              `KTU API internal server error`,
              `KTU’s service is unavailable. Please try again later.`,
              statusCode,
              url,
              error
            );
          case 404:
            throw new KTUAPIError(
              serviceName,
              `Data not found on KTU API`,
              `The requested information isn’t available from KTU.`,
              statusCode,
              url,
              error
            );
          default:
            throw new KTUAPIError(
              serviceName,
              `KTU API error`,
              `Couldn’t load the data from KTU. Please try again later.`,
              statusCode,
              url,
              error
            );
        }
      }

      if (error instanceof RequestError) {
        const url = error.request?.requestUrl?.toString();

        throw new KTUAPIError(
          serviceName,
          `Network error: ${error.message}`,
          `Couldn’t connect to KTU. Please try again later.`,
          undefined,
          url,
          error
        );
      }

      if (error instanceof ZodError) {
        throw new KTUAPIError(
          serviceName,
          `API response validation failed: ${error.message}`,
          `Couldn’t read KTU’s response. Please try again later.`,
          undefined,
          undefined,
          error
        );
      }

      throw error;
    }
  };
}
