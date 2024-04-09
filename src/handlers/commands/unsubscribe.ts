import { CustomContext } from "types/customContext.type";
import db from "@/firebase/firestore";
import deleteMessage from "utils/deleteMessage";

async function unsubscribe(ctx: CustomContext) {
  const chatId = ctx.chat!.id;
  if (!chatId) {
    await ctx.reply("An error occured");
    throw new Error("Chat id not found");
  }
  let waitingMsgId: number;
  try {
    const waitingMsg = await ctx.reply("Unsubscribing.. Please wait..");
    waitingMsgId = waitingMsg.message_id;
    const userRef = db.collection("subscribedUsers").doc(chatId.toString());
    const doc = await userRef.get();
    if (doc.exists) {
      await userRef.delete();
      await deleteMessage(ctx, waitingMsgId);
      await ctx.reply("You are now unsubscribed from notifications");
    } else {
      await deleteMessage(ctx, waitingMsgId);
      await ctx.reply(
        "You are not subscribed to notifications.\n\nPlease use /subscribe to subscribe to notifications."
      );
    }
  } catch (error) {
    console.log(error);
  }
}

export default unsubscribe;
