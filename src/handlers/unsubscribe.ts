import { CustomContext } from "../types/customContext.type";
import db from "../db/initDb";

async function unsubscribe(ctx: CustomContext) {
  const chatId = ctx.chat!.id;
  if (!chatId) {
    await ctx.reply("Chat id not found");
    throw new Error("Chat id not found");
  }
  try {
    const userRef = db.collection("subscribedUsers").doc(chatId.toString());
    const doc = await userRef.get();
    if (doc.exists) {
      await userRef.delete();
      await ctx.reply("You are now unsubscribed from notifications");
    } else {
      await ctx.reply(
        "You are not subscribed to notifications. Please use /subscribe to subscribe to notifications."
      );
    }
  } catch (error) {
    console.log(error);
  }
}

export default unsubscribe;
