import { z } from "zod";

const llmConfigSchema = z.object({
  API_KEY: z.string(),
  COMPLETION_MODEL: z.string(),
  TEMPERATURE: z.number().min(0).max(2),
  MAX_TOKENS: z.number().positive(),
  TIMEOUT_MS: z.number().positive(),
  MAX_RETRIES: z.number().min(0),
});

export const LLMConfigSchema = llmConfigSchema.parse({
  API_KEY: process.env.GROQ_API_KEY,
  COMPLETION_MODEL: "llama-3.3-70b-versatile",
  TEMPERATURE: 0.1,
  MAX_TOKENS: 50,
  TIMEOUT_MS: 1 * 60 * 1000, // 1 minute
  MAX_RETRIES: 2,
});
