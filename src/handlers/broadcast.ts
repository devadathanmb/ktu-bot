// Handler to broadcast messages to all subscribed users
// Only to be used by admin
// This current implementation is blocking the main thread, will need to be fixed in future
import { Firestore } from "firebase-admin/firestore";
import { CustomContext } from "../types/customContext.type";

async function broadcast(ctx: CustomContext, db: Firestore) {
  const stickerId =
    "CAACAgUAAxUAAWWjgMI_MTUi4o-bmnQYlC092WTkAALEAwACGvW5VeOu79-faKRbNAQ";
  if (ctx.from?.id.toString() !== process.env.ADMIN_ID) {
    console.log(ctx.from?.id);
    console.log(process.env.ADMIN_ID);
    await ctx.replyWithSticker(stickerId);
    return;
  }
  // @ts-ignore
  const message = ctx.message!.text.split("/broadcast ")[1];

  // Get all users
  const usersRef = db.collection("subscribedUsers");
  const snapshot = await usersRef.get();
  const chatIds = snapshot.docs.map((doc) => doc.data().chatId);

  // Send message to all users
  // Send in batahces of 25
  // Wait one minute after each batch
  const batchSize = 25;
  const delay = 60000;

  await ctx.reply("Broadcasting message...");
  for (let i = 0; i < chatIds.length; i += batchSize) {
    console.log(`⚡ Broadcasting batch ${i / batchSize + 1} at ${new Date()}`);
    const batch = chatIds.slice(i, i + batchSize);
    let batchPromises: Promise<any>[] = [];
    batch.forEach((chatId) => {
      batchPromises.push(
        ctx.telegram
          .sendMessage(chatId, message, {
            parse_mode: "HTML",
            disable_web_page_preview: true,
          })
          .catch((error) => {
            console.log(error);
          })
      );
    });

    await Promise.all(batchPromises);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
  console.log(`⚡ Broadcast completed at ${new Date()}`);
  await ctx.reply("Broadcast completed");
}

export default broadcast;
