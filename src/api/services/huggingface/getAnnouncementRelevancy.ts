import { z } from "zod";
import client from "../../client.js";
import { HUGGING_FACE_API } from "../../../constants/api.js";
import { ExternalApiConfig } from "../../../configs/api.js";
import logger from "../../../utils/logger.js";

// Zod schema for Hugging Face API response validation with transformations
const HuggingFaceRelevancyResponseSchema = z
  .tuple([
    z.tuple([
      z.object({
        label: z
          .string()
          .regex(/^LABEL_[01]$/, "Invalid label format")
          .transform(label => label === "LABEL_1"),
        score: z.number(),
      }),
    ]),
  ])
  .transform(([[firstItem]]) => firstItem.label);

async function _getAnnouncementRelevancy(inputText: string): Promise<boolean> {
  const payload = {
    inputs: inputText,
    options: {
      // If the model is not already loaded, wait for it to load
      // If this is not set, we get an immediate response with the model not loaded error
      wait_for_model: true,
    },
  };

  const response = await client.post(HUGGING_FACE_API.RELEVANCY_ENDPOINT, {
    json: payload,
    // responseType: "json" as const,
    headers: {
      Authorization: `Bearer ${ExternalApiConfig.HUGGING_FACE_API_TOKEN}`,
    },
    // Hugging Face API might take ~20 seconds to load the model
    timeout: {
      request: 30000,
    },
  });

  // Validate and transform API response with Zod - returns boolean directly
  return HuggingFaceRelevancyResponseSchema.parse(response.body);
}

// Export with custom error handling - return true (relevant) on any error for safety
export async function getAnnouncementRelevancy(text: string): Promise<boolean> {
  try {
    return await _getAnnouncementRelevancy(text);
  } catch (error: unknown) {
    /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    logger.debug(error);
    const errorMessage = (error as any)?.message || "Unknown error occurred";
    const statusCode = (error as any)?.response?.statusCode;
    const responseBody = (error as any)?.response?.body;

    logger.error(
      {
        service: "getRelevancy",
        error: errorMessage,
        statusCode,
        responseBody: responseBody ? JSON.stringify(responseBody) : undefined,
        inputText: text,
      },
      "Service getRelevancy failed - defaulting to relevant"
    );

    // In any case this fails, it is always best to assume the announcement is relevant
    return true;
  }
}
