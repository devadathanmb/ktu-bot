import { Firestore } from "firebase-admin/firestore";
import { CustomContext } from "../types/customContext.type";

async function unsubscribe(ctx: CustomContext, db: Firestore) {
  const chatId = ctx.chat!.id;
  if (!chatId) {
    await ctx.reply("Chat id not found");
    throw new Error("Chat id not found");
  }
  try {
    const usersRef = db.collection("subscribedUsers").doc(chatId.toString());
    const doc = await usersRef.get();
    if (doc.exists) {
      await usersRef.delete();
      await ctx.reply("You are now unsubscribed from notifications");
    } else {
      await ctx.reply(
        "You are not subscribed to notifications. Please use /subscribe to subscribe to notifications.",
      );
    }
  } catch (error) {
    console.log(error);
  }
}

export default unsubscribe;
