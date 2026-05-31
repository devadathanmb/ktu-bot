import got from "got";
import { z } from "zod";
import { LLMConfigSchema } from "../../../configs/llm.js";
import { GROQ_API } from "../../../constants/llm.js";
import {
  ANNOUNCEMENT_RELEVANCE_PROMPT,
  buildCourseFindingPrompt,
} from "./prompts.js";
import logger from "../../../utils/logger.js";
import {
  AnnouncementFilter,
  COURSES,
  type Course,
} from "../../../constants/courses.js";

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
    const validCourses = data.relevant_courses.filter(
      (course): course is Course => COURSES.has(course as Course)
    );
    return new Set<AnnouncementFilter>(validCourses);
  });

function parseJsonResponse<T>(schema: z.ZodSchema<T>, jsonString: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("Invalid JSON in LLM response");
  }
  return schema.parse(parsed);
}

export class LLMService {
  private config: typeof LLMConfigSchema;

  constructor() {
    this.config = LLMConfigSchema;
  }

  private async makeGroqRequest(
    request: z.infer<typeof GroqCompletionRequestSchema>
  ): Promise<z.infer<typeof GroqCompletionResponseSchema>> {
    const validatedRequestPayload = GroqCompletionRequestSchema.parse(request);

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

    return GroqCompletionResponseSchema.parse(response.body);
  }

  async findRelevantCoursesFromAnnouncement(
    announcementContent: string
  ): Promise<Set<AnnouncementFilter>> {
    try {
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

      return parseJsonResponse(
        AnnouncementRelevantCoursesResultSchema,
        response.choices[0]!.message.content
      );
    } catch (error) {
      if (error instanceof z.ZodError) {
        const announcement = announcementContent.substring(0, 100) + "...";
        logger.warn(
          {
            err: error,
            announcement,
          },
          "Validation error in LLM course finding service"
        );
      } else {
        logger.error(
          { err: error as Error },
          "Error in LLM course finding service"
        );
      }

      return new Set<AnnouncementFilter>();
    }
  }

  async isAnnouncementRelevant(announcementContent: string): Promise<boolean> {
    try {
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

      return parseJsonResponse(
        AnnouncementRelevanceResultSchema,
        response.choices[0]!.message.content
      ).is_relevant;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const announcement = announcementContent.substring(0, 100) + "...";
        logger.warn(
          {
            err: error,
            announcement,
          },
          "Validation error in LLM service"
        );
      } else {
        logger.error(
          { err: error as Error },
          "Error in LLM announcement relevance check"
        );
      }

      return true;
    }
  }
}
