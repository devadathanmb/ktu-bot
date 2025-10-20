import { z } from "zod";

// Define the API config schema with validation
const externalApiConfigSchema = z.object({
  UPTIME_ROBOT_API_KEY: z.string(),
  HUGGING_FACE_API_TOKEN: z.string(),
  BETTER_UPTIME_API_TOKEN: z.string(),
  BETTER_UPTIME_MONITOR_GROUP_ID: z.string(),
});

// Parse and validate the config from environment variables
export const ExternalApiConfig = externalApiConfigSchema.parse({
  UPTIME_ROBOT_API_KEY: process.env.UPTIME_ROBOT_API_KEY,
  HUGGING_FACE_API_TOKEN: process.env.HUGGING_FACE_API_TOKEN || "",
  BETTER_UPTIME_API_TOKEN: process.env.BETTER_UPTIME_API_TOKEN,
  BETTER_UPTIME_MONITOR_GROUP_ID: process.env.BETTER_UPTIME_MONITOR_GROUP_ID,
});
