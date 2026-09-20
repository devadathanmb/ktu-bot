import { z } from "zod";

const llmConfigSchema = z.object({
  API_KEY: z.string().trim().min(1),
  COMPLETION_MODEL: z.string(),
  TEMPERATURE: z.number().min(0).max(2),
  TIMEOUT_MS: z.number().positive(),
  MAX_RETRIES: z.number().min(0),
});

export const LLMConfig = llmConfigSchema.parse({
  API_KEY: process.env.GROQ_API_KEY,
  // GPT-OSS-only: requests send `reasoning_effort` and strict Structured
  // Outputs, which non-reasoning models reject. Keep model and request
  // params in sync when changing this.
  COMPLETION_MODEL: "openai/gpt-oss-20b",
  TEMPERATURE: 0.1,
  TIMEOUT_MS: 1 * 60 * 1000, // 1 minute
  MAX_RETRIES: 2,
});
