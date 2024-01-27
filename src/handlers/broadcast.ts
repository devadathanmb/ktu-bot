// Handler to broadcast messages to all subscribed users
// Only to be used by admin
import { Firestore } from "firebase-admin/firestore";
import { CustomContext } from "../types/customContext.type";
import Queue = require("bull");
import { TelegramError } from "telegraf";

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

  // Create a queue to store all the chatIds
  const queue = new Queue("broadcast-queue");
  for (let i = 0; i < chatIds.length; i++) {
    await queue.add({
      chatId: chatIds[i],
      message: message,
    });
  }

  // Consumer
  // Send messages to users one by one until telegram start throwing 429
  // Wait for the retry_after time and then add the job back to the queue
  // And then continue with the next job
  queue.process(async (job) => {
    try {
      await ctx.telegram.sendMessage(job.data.chatId, job.data.message, {
        parse_mode: "HTML",
        disable_web_page_preview: true,
      });
      await job.remove();
    } catch (error: any) {
      if (error instanceof TelegramError) {
        if (error.code === 429) {
          const retryAfter = error.parameters?.retry_after!;
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000 + 2000)
          );
          await job.retry();
        }
      }
    }
  });

  queue.on("completed", (job) => {
    console.log(`✅ Message sent to ${job.data.chatId}`);
  });
}

export default broadcast;
