import { HTTPError, RequestError } from "got";
import { ZodError } from "zod";
import { KTUAPIError } from "../../errors/bot-errors.js";
import logger from "../../utils/logger.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withServiceWrapper<TArgs extends any[], TReturn>(
  serviceName: string,
  serviceFunction: (...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await serviceFunction(...args);
    } catch (error: unknown) {
      // Handle HTTP errors from got
      if (error instanceof HTTPError) {
        const statusCode = error.response.statusCode;
        const url = (
          error.response.requestUrl || error.options.url
        )?.toString();

        logger.error(
          {
            service: serviceName,
            err: error,
            statusCode,
            url,
          },
          `Error in ${serviceName}`
        );

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
        const url = error.options?.url?.toString();

        logger.error(
          {
            service: serviceName,
            err: error,
            url,
          },
          `Error in ${serviceName}`
        );

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
        logger.error(
          {
            service: serviceName,
            err: error,
          },
          `Zod validation error in ${serviceName}`
        );

        throw new KTUAPIError(
          serviceName,
          `API response validation failed: ${error.message}`,
          `The API returned data in an unexpected format. Please try again later.`,
          undefined,
          undefined,
          error
        );
      }

      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call */
      const errorStatusCode = (error as any)?.response?.statusCode;
      const errorUrl =
        (error as any)?.response?.requestUrl?.toString() ||
        (error as any)?.options?.url?.toString();

      logger.error(
        {
          service: serviceName,
          err: error as Error,
          statusCode: errorStatusCode,
          url: errorUrl,
        },
        `Error in ${serviceName}`
      );

      // If the error is not handled above, re-throw
      throw error;
    }
  };
}
