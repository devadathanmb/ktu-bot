import { CustomContext } from "types/customContext.type";
import { FILTERS } from "constants/constants";
import { Markup } from "telegraf";
import deleteMessage from "utils/deleteMessage";
import db from "@/firebase/firestore";
import Logger from "@/utils/logger";

const logger = new Logger("SUBSCRIBE");

async function subscribe(ctx: CustomContext) {
  const waitingMsg = await ctx.reply("Please wait...");
  const chatId = ctx.chat!.id;
  try {
    const usersRef = db.collection("subscribedUsers").doc(chatId.toString());
    const doc = await usersRef.get();
    if (doc.exists) {
      await ctx.reply(
        "You are already subscribed to notifications.\n\nUse /changefilter to change your notification filter."
      );
      await deleteMessage(ctx, waitingMsg.message_id);
    } else {
      const msg = `
🔴 Choose the type of notifications you want to receive. 

• Please select <b>ALL NOTIFCATIONS</b> if you want to receive all notifications.

• Choose <b>ALL RELEVANT NOTFIS</b> if you want to receive ALL notifications but only relevant to students of <b>all courses</b>.

• Otherwise, select the specific course you want to receive notifications for.

<b>NOTE : Choosing course specific notifications will include other important notifications relevant for students.</b>

Choose a filter from the options below:
`;
      const filterButtons = Object.keys(FILTERS).map((filter) => ({
        text: FILTERS[filter],
        callback_data: `filter_${filter}`,
      }));

      filterButtons.push({
        text: "Cancel operation ❌",
        callback_data: "filter_cancel",
      });

      const keyboard = Markup.inlineKeyboard(filterButtons, { columns: 2 });
      await ctx.replyWithHTML(msg, keyboard);
      await deleteMessage(ctx, waitingMsg.message_id);
    }
  } catch (err) {
    logger.error(
      `Error in subscribing user with chatId: ${chatId}. Error: ${err}`
    );
  }
}

export default subscribe;
