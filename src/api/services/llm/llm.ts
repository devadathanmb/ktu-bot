import got from "got";
import { z } from "zod";
import { LLMConfigSchema } from "../../../configs/llm.js";
import { GROQ_API } from "../../../constants/llm.js";
import {
  ANNOUNCEMENT_RELEVANCE_PROMPT,
  buildCourseFindingPrompt,
} from "./prompts.js";
import logger from "../../../utils/logger.js";
import { COURSES } from "../../../constants/courses.js";

// Zod schemas for validation
const GroqMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: z.string(),
});

const GroqCompletionRequestSchema = z.object({
  model: z.string(),
  messages: z.array(GroqMessageSchema),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().positive().optional(),
});

const GroqCompletionResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string(),
          role: z.string(),
        }),
        finish_reason: z.string(),
      })
    )
    .min(1), // Ensure at least one choice
  usage: z
    .object({
      prompt_tokens: z.number(),
      completion_tokens: z.number(),
      total_tokens: z.number(),
    })
    .optional(),
});

const AnnouncementRelevanceResultSchema = z.object({
  is_relevant: z.boolean(),
});

const AnnouncementRelevantCoursesResultSchema = z
  .object({
    relevant_courses: z.array(z.string()),
  })
  .transform(data => {
    // Filter to only include valid course codes
    const validCourses = data.relevant_courses.filter(course =>
      COURSES.has(course as never)
    );
    return new Set(validCourses);
  });

export type AnnouncementRelevanceResult = z.infer<
  typeof AnnouncementRelevanceResultSchema
>;

export class LLMService {
  private config: typeof LLMConfigSchema;

  constructor() {
    this.config = LLMConfigSchema;
  }

  private async makeGroqRequest(
    request: z.infer<typeof GroqCompletionRequestSchema>
  ): Promise<z.infer<typeof GroqCompletionResponseSchema>> {
    // Validate request
    const validatedRequestPayload = GroqCompletionRequestSchema.parse(request);

    try {
      const response = await got.post(GROQ_API.COMPLETION_ENDPOINT, {
        headers: {
          "Authorization": `Bearer ${this.config.API_KEY}`,
          "Content-Type": "application/json",
        },
        json: validatedRequestPayload,
        responseType: "json",
        timeout: {
          request: this.config.TIMEOUT_MS,
        },
        retry: {
          limit: this.config.MAX_RETRIES,
        },
      });

      // Validate response
      return GroqCompletionResponseSchema.parse(response.body);
    } catch (error: unknown) {
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
      // Log the response body for better debugging
      if ((error as any).response?.body) {
        const statusCode = (error as any).response.statusCode;
        const errorBody = (error as any).response.body;
        const requestBody = validatedRequestPayload;
        logger.error(
          {
            statusCode,
            errorBody,
            requestBody,
          },
          "Groq API request failed"
        );
      }
      throw error;
    }
  }

  async findRelevantCoursesFromAnnouncement(
    announcementContent: string
  ): Promise<Set<string>> {
    try {
      // Validate input
      z.string().min(1).parse(announcementContent);

      const prompt = buildCourseFindingPrompt(announcementContent);

      const request = {
        model: this.config.COMPLETION_MODEL,
        messages: [
          {
            role: "user" as const,
            content: prompt,
          },
        ],
        temperature: this.config.TEMPERATURE,
        max_tokens: this.config.MAX_TOKENS,
      };

      const response = await this.makeGroqRequest(request);

      // Parse and validate JSON response
      const parsedJson = JSON.parse(response.choices[0]!.message.content);
      const validatedResult =
        AnnouncementRelevantCoursesResultSchema.parse(parsedJson);
      return validatedResult;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const announcement = announcementContent.substring(0, 100) + "...";
        logger.warn(
          {
            error,
            announcement,
          },
          "Validation error in LLM course finding service"
        );
      } else {
        logger.error(error, "Error in LLM course finding service");
      }

      // Return empty set as fallback
      return new Set<string>();
    }
  }

  async isAnnouncementRelevant(
    announcementContent: string
  ): Promise<AnnouncementRelevanceResult> {
    try {
      // Validate input
      z.string().min(1).parse(announcementContent);

      const prompt = ANNOUNCEMENT_RELEVANCE_PROMPT.replace(
        "{announcement_content}",
        announcementContent
      );

      const request = {
        model: this.config.COMPLETION_MODEL,
        messages: [
          {
            role: "user" as const,
            content: prompt,
          },
        ],
        temperature: this.config.TEMPERATURE,
        max_tokens: this.config.MAX_TOKENS,
      };

      const response = await this.makeGroqRequest(request);

      // Parse and validate JSON response

      const parsedJson = JSON.parse(response.choices[0]!.message.content);
      const validatedResult =
        AnnouncementRelevanceResultSchema.parse(parsedJson);

      return validatedResult;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const announcement = announcementContent.substring(0, 100) + "...";
        logger.warn(
          {
            error: error.issues,
            announcement,
          },
          "Validation error in LLM service"
        );
      } else {
        logger.error(error, "Error in LLM announcement relevance check");
      }

      // Return true as fallback to ensure announcements are not missed
      return { is_relevant: true };
    }
  }
}
