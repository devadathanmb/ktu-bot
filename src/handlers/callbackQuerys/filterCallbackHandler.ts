// Callback handler for the change filter / subscribe command
import { CustomContext } from "types/customContext.type";
import deleteMessage from "utils/deleteMessage";
import { FILTERS } from "constants/constants";
import db from "@/firebase/firestore";
import { callbackQuery } from "telegraf/filters";
import logger from "@/utils/logger";

async function filterCallbackHandler(ctx: CustomContext) {
  await ctx.answerCbQuery();
  const waitingMsg = await ctx.reply("Please wait...");
  if (!ctx.has(callbackQuery("data"))) {
    await deleteMessage(ctx, waitingMsg.message_id);
    await ctx.reply(
      "Invalid filter. Please choose a valid filter from the options."
    );
    return;
  }
  const chosenFilter = ctx.callbackQuery.data.split("_")[1];
  const changeFilterMsgId = ctx.callbackQuery!.message!.message_id;
  if (chosenFilter === "cancel") {
    await ctx.reply("Notification filter operation cancelled.");
    await deleteMessage(ctx, changeFilterMsgId);
    await deleteMessage(ctx, waitingMsg.message_id);
    return;
  }

  if (!chosenFilter || !Object.keys(FILTERS).includes(chosenFilter)) {
    await deleteMessage(ctx, waitingMsg.message_id);
    await ctx.reply(
      "Invalid filter. Please choose a valid filter from the options."
    );
    return;
  }

  const chatId = ctx.chat!.id;
  try {
    const usersRef = db.collection("subscribedUsers").doc(chatId.toString());
    const doc = await usersRef.get();
    if (doc.exists) {
      await usersRef.update({
        courseFilter: chosenFilter,
      });

      await deleteMessage(ctx, changeFilterMsgId);
      await deleteMessage(ctx, waitingMsg.message_id);
      await ctx.replyWithHTML(
        `Notification filter changed to <b>${FILTERS[chosenFilter]}</b> successfully!`
      );
    } else {
      await usersRef.set({
        chatId: chatId,
        courseFilter: chosenFilter,
      });
      await ctx.replyWithHTML(
        `You are now subscribed to notifications for <b>${FILTERS[chosenFilter]}</b> successfully!`
      );
      await deleteMessage(ctx, changeFilterMsgId);
      await deleteMessage(ctx, waitingMsg.message_id);
    }
  } catch (err) {
    logger.error(`[FILTER] Error in filterCallbackHandler: ${err}`);
  }
}

export default filterCallbackHandler;
