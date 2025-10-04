import { z } from "zod";

// Define the API config schema with validation
const externalApiConfigSchema = z.object({
  UPTIME_ROBOT_API_KEY: z.string(),
  HUGGING_FACE_API_TOKEN: z.string(),
});

// Parse and validate the config from environment variables
export const ExternalApiConfig = externalApiConfigSchema.parse({
  UPTIME_ROBOT_API_KEY: process.env.UPTIME_ROBOT_API_KEY,
  HUGGING_FACE_API_TOKEN: process.env.HUGGING_FACE_API_TOKEN,
});
