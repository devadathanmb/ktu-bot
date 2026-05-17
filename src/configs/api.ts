import { z } from "zod";

const externalApiConfigSchema = z.object({
  UPTIME_ROBOT_API_KEY: z.string(),
  BETTER_UPTIME_API_TOKEN: z.string(),
  BETTER_UPTIME_MONITOR_GROUP_ID: z.string(),
});

export const ExternalApiConfig = externalApiConfigSchema.parse({
  UPTIME_ROBOT_API_KEY: process.env.UPTIME_ROBOT_API_KEY,
  BETTER_UPTIME_API_TOKEN: process.env.BETTER_UPTIME_API_TOKEN,
  BETTER_UPTIME_MONITOR_GROUP_ID: process.env.BETTER_UPTIME_MONITOR_GROUP_ID,
});
