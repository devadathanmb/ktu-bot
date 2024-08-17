import bot from "@/bot/bot";
import availableCommands from "constants/availableCommands";

// Set the available commands for the bot
async function setCommands() {
  return await bot.telegram.setMyCommands(availableCommands);
}

export default setCommands;
