// Handler to change notification filter of user
import { CustomContext } from "types/customContext.type";
import { FILTERS } from "constants/constants";
import { Markup } from "telegraf";
import deleteMessage from "utils/deleteMessage";
import db from "@/firebase/firestore";

async function changeFilter(ctx: CustomContext) {
  const waitingMsg = await ctx.reply("Please wait...");
  const chatId = ctx.chat!.id;
  try {
    const usersRef = db.collection("subscribedUsers").doc(chatId.toString());
    const doc = await usersRef.get();
    if (!doc.exists) {
      await ctx.reply(
        "You are not subscribed to notifications.\n\nPlease subscribe using /subscribe command to subscribe to notifications."
      );
      await deleteMessage(ctx, waitingMsg.message_id);
    } else {
      const currentFilter = FILTERS[doc.get("courseFilter")];
      const msg = `
Your current notification filter is set to <b>${currentFilter}</b>

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
    console.log(err);
  }
}

export default changeFilter;
