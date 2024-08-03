import bot from "@/bot";
import availableCommands from "constants/availableCommands";
import logger from "@/utils/logger";

// Set the available commands for the bot
async function setCommands() {
  logger.info("[TELEGRAF] Setting commands");
  await bot.telegram.setMyCommands(availableCommands);
}

export default setCommands;
