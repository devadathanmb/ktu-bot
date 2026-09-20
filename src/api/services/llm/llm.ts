import got, { HTTPError } from "got";
import { z } from "zod";
import { LLMConfig } from "../../../configs/llm.js";
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
  reasoning_effort: z.enum(["low", "medium", "high"]).optional(),
  response_format: z
    .object({
      type: z.literal("json_schema"),
      json_schema: z.object({
        name: z.string(),
        strict: z.literal(true),
        schema: z.record(z.string(), z.unknown()),
      }),
    })
    .optional(),
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

// Strict Structured Outputs schemas (constrained decoding, guaranteed
// schema-valid JSON). openai/gpt-oss-20b supports strict mode; all fields
// are required and additionalProperties is false, per Groq docs.
const ANNOUNCEMENT_RELEVANCE_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "announcement_relevance",
    strict: true,
    schema: {
      type: "object",
      properties: {
        is_relevant: { type: "boolean" },
      },
      required: ["is_relevant"],
      additionalProperties: false,
    },
  },
} as const;

const ANNOUNCEMENT_COURSES_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "announcement_courses",
    strict: true,
    schema: {
      type: "object",
      properties: {
        relevant_courses: { type: "array", items: { type: "string" } },
      },
      required: ["relevant_courses"],
      additionalProperties: false,
    },
  },
} as const;

type GroqCompletionRequest = z.infer<typeof GroqCompletionRequestSchema>;
type GroqCompletionResponse = z.infer<typeof GroqCompletionResponseSchema>;

export type GroqCompletionRequester = (
  request: GroqCompletionRequest
) => Promise<GroqCompletionResponse>;

function createGroqCompletionRequester(): GroqCompletionRequester {
  return async request => {
    const validatedRequestPayload = GroqCompletionRequestSchema.parse(request);

    const response = await got.post(GROQ_API.COMPLETION_ENDPOINT, {
      headers: {
        "Authorization": `Bearer ${LLMConfig.API_KEY}`,
        "Content-Type": "application/json",
      },
      json: validatedRequestPayload,
      responseType: "json",
      timeout: {
        request: LLMConfig.TIMEOUT_MS,
      },
      retry: {
        limit: LLMConfig.MAX_RETRIES,
        methods: ["POST"],
      },
    });

    return GroqCompletionResponseSchema.parse(response.body);
  };
}

function parseJsonResponse<T>(schema: z.ZodType<T>, jsonString: string): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonString);
  } catch {
    throw new Error("Invalid JSON in LLM response");
  }
  return schema.parse(parsed);
}

function isRateLimitError(error: unknown): error is HTTPError {
  return error instanceof HTTPError && error.response.statusCode === 429;
}

function logRateLimit(error: HTTPError, operation: string): void {
  logger.warn(
    {
      service: "groq",
      operation,
      statusCode: error.response.statusCode,
      retryAfter: error.response.headers["retry-after"],
    },
    "LLM service rate limited"
  );
}

/**
 * LLM classification service with an injectable requester dependency so unit
 * tests can exercise the fallback policy without network access.
 */
export class LLMService {
  constructor(
    private readonly requestCompletion: GroqCompletionRequester = createGroqCompletionRequester()
  ) {}

  async findRelevantCoursesFromAnnouncement(
    announcementContent: string
  ): Promise<Set<AnnouncementFilter>> {
    try {
      z.string().min(1).parse(announcementContent);

      const prompt = buildCourseFindingPrompt(announcementContent);

      const request = {
        model: LLMConfig.COMPLETION_MODEL,
        messages: [
          {
            role: "user" as const,
            content: prompt,
          },
        ],
        temperature: LLMConfig.TEMPERATURE,
        reasoning_effort: "low" as const,
        response_format: ANNOUNCEMENT_COURSES_RESPONSE_FORMAT,
      };

      const response = await this.requestCompletion(request);

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
      } else if (isRateLimitError(error)) {
        logRateLimit(error, "course-finding");
      } else {
        logger.error({ err: error }, "Error in LLM course finding service");
      }

      // Fail open by returning an empty set: the resolver keeps its broader
      // regex-derived audience instead of narrowing it to LLM-chosen courses.
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
        model: LLMConfig.COMPLETION_MODEL,
        messages: [
          {
            role: "user" as const,
            content: prompt,
          },
        ],
        temperature: LLMConfig.TEMPERATURE,
        reasoning_effort: "low" as const,
        response_format: ANNOUNCEMENT_RELEVANCE_RESPONSE_FORMAT,
      };

      const response = await this.requestCompletion(request);

      return parseJsonResponse(
        AnnouncementRelevanceResultSchema,
        response.choices[0]!.message.content
      ).is_relevant;
    } catch (error) {
      // Fail open: every classification failure (validation, API, rate limit)
      // must deliver a potentially relevant notification rather than suppress
      // it. Only the schema-valid `is_relevant: false` returned above
      // suppresses the student/relevant audience.
      if (error instanceof z.ZodError) {
        const announcement = announcementContent.substring(0, 100) + "...";
        logger.warn(
          {
            err: error,
            announcement,
          },
          "Validation error in LLM service"
        );
      } else if (isRateLimitError(error)) {
        logRateLimit(error, "announcement-relevance");
      } else {
        logger.error(
          { err: error },
          "Error in LLM announcement relevance check"
        );
      }

      return true;
    }
  }
}
