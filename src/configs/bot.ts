import { z } from "zod";

const availableDeploymentTypes = {
  LONG_POLLING: "LONG_POLLING",
  WEBHOOK: "WEBHOOK",
};

const botConfigSchema = z
  .object({
    BOT_HEALTH_CHECK_PORT: z.coerce.number().positive(),
    BOT_FILE_UPLOAD_CHANNEL_ID: z.coerce.number().negative(),
    BOT_TOKEN: z.string(),
    NODE_ENV: z.enum(["development", "production"]),
    BOT_IMAGE_URL: z.string(),
    BOT_DEPLOYMENT_TYPE: z
      .enum([...Object.values(availableDeploymentTypes)])
      .default(availableDeploymentTypes.LONG_POLLING),
    BOT_SESSION_DATA_TTL: z.coerce
      .number()
      .positive()
      .default(10 * 60 * 1000), // 10 minutes
    ENABLE_PROMETHEUS_METRICS: z
      .enum(["true", "false"])
      .default("false")
      .transform(v => v === "true"),
  })
  .transform(config => ({
    ...config,
    IS_LONG_POLLING_DEPLOYMENT:
      config.BOT_DEPLOYMENT_TYPE === availableDeploymentTypes.LONG_POLLING,
    UNKNOWN_COMMAND_STICKER_DELETION_TIMEOUT: 5 * 1000, // 5 seconds
  }));

export const BotConfig = botConfigSchema.parse({
  BOT_FILE_UPLOAD_CHANNEL_ID: process.env.BOT_FILE_UPLOAD_CHANNEL_ID,
  BOT_TOKEN: process.env.BOT_TOKEN,
  NODE_ENV: process.env.NODE_ENV || "development",
  BOT_IMAGE_URL:
    process.env.BOT_IMAGE_URL ||
    "https://raw.githubusercontent.com/devadathanmb/ktu-bot/refs/heads/grammy-rewrite/assets/bot-profile-pic.jpg",
  BOT_DEPLOYMENT_TYPE: process.env.BOT_DEPLOYMENT_TYPE,
  BOT_SESSION_DATA_TTL: process.env.BOT_SESSION_DATA_TTL,
  BOT_HEALTH_CHECK_PORT: process.env.BOT_HEALTH_CHECK_PORT,
  ENABLE_PROMETHEUS_METRICS: process.env.ENABLE_PROMETHEUS_METRICS,
});
