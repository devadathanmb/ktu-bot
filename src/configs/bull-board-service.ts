import { z } from "zod";

const bullBoardServiceConfigSchema = z.object({
  PORT: z.coerce.number().default(3010),
});

export const BullBoardServiceConfig = bullBoardServiceConfigSchema.parse({
  PORT: process.env.BULL_BOARD_PORT,
});
