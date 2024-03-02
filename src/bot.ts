import { Telegraf } from "telegraf";
import { CustomContext } from "@/types/customContext.type";
import "dotenv/config";

const opts = {
  // During result publish times, KTU servers will be slow to respond, this makes the API requests to be slower
  // Axios timeout is set to 25 seconds, but telegraf will timeout before that
  // This creates request duplication. Hence we need to increase the telegraf timeout
  handlerTimeout: 1000 * 30,
};

const bot = new Telegraf<CustomContext>(process.env.BOT_TOKEN!, opts);

// The top level error handler
// this will catch any errors that may happen
bot.catch((error) => {
  console.error("TELEGRAF ERROR", error);
});

export default bot;
