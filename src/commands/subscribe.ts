import { Firestore } from "firebase-admin/firestore";
import { CustomContext } from "../types/customContext.type";

async function subscribe(ctx: CustomContext, db: Firestore) {
  const chatId = ctx.chat!.id;
  if (!chatId) {
    ctx.reply("Chat id not found");
    throw new Error("Chat id not found");
  }
  try {
    const usersRef = db.collection("subscribedUsers").doc(chatId.toString());
    const doc = await usersRef.get();
    if (!doc.exists) {
      await usersRef.set({
        chatId,
      });
      await ctx.reply("You are now subscribed to notifications");
    } else {
      await ctx.reply("You are already subscribed to notifications");
    }
  } catch (err) {
    console.log(err);
  }
}

export default subscribe;
