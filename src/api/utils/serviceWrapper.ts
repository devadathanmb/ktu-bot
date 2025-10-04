import { HTTPError, RequestError } from "got";
import { ZodError } from "zod";
import { KTUAPIError } from "../../errors/BotErrors.js";
import logger from "../../utils/logger.js";

export function withServiceWrapper<TArgs extends any[], TReturn>(
  serviceName: string,
  serviceFunction: (...args: TArgs) => Promise<TReturn>
) {
  return async (...args: TArgs): Promise<TReturn> => {
    try {
      return await serviceFunction(...args);
    } catch (error: unknown) {
      logger.error(error);
      logger.error(
        {
          service: serviceName,
          statusCode: (error as any)?.response?.statusCode,
          url:
            (error as any)?.response?.requestUrl?.toString() ||
            (error as any)?.options?.url?.toString(),
          responseBody: (error as any)?.response?.body,
          code: (error as any)?.code,
        },
        `Error in ${serviceName}`
      );

      // Handle HTTP errors from got
      if (error instanceof HTTPError) {
        const statusCode = error.response.statusCode;
        const url = (
          error.response.requestUrl || error.options.url
        )?.toString();

        // Throw KTUAPIError with specific user messages for different status codes
        switch (statusCode) {
          case 429:
            throw new KTUAPIError(
              serviceName,
              `KTU API rate limited`,
              `KTU API is busy. Please try again after sometime.`,
              statusCode,
              url
            );
          case 403:
            throw new KTUAPIError(
              serviceName,
              `KTU API access denied`,
              `Access denied to KTU API. Please try again later.`,
              statusCode,
              url
            );
          case 500:
            throw new KTUAPIError(
              serviceName,
              `KTU API internal server error`,
              `KTU API is currently unavailable. Please try again later.`,
              statusCode,
              url
            );
          case 404:
            throw new KTUAPIError(
              serviceName,
              `Data not found on KTU API`,
              `Requested data not found. Please try again.`,
              statusCode,
              url
            );
          default:
            throw new KTUAPIError(
              serviceName,
              `KTU API error`,
              `KTU API is currently having issues. Please try again later.`,
              statusCode,
              url
            );
        }
      }

      // Handle request errors from got (network issues, timeouts, etc.)
      if (error instanceof RequestError) {
        const url = error.options?.url?.toString();

        throw new KTUAPIError(
          serviceName,
          `Network error: ${error.message}`,
          `Unable to connect to KTU API. Please try again later.`,
          undefined,
          url
        );
      }

      // Handle Zod validation errors (invalid API response format)
      if (error instanceof ZodError) {
        logger.error(
          {
            service: serviceName,
            zodError: error.format(),
            issues: error.issues,
          },
          `Zod validation error in ${serviceName}`
        );

        throw new KTUAPIError(
          serviceName,
          `API response validation failed: ${error.message}`,
          `The API returned data in an unexpected format. Please try again later.`,
          undefined,
          undefined
        );
      }

      // If the error is not handled above, re-throw
      throw error;
    }
  };
}
