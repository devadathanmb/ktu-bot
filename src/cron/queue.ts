import { Telegraf, TelegramError } from "telegraf";
import { CustomContext } from "../types/customContext.type";
import Bull = require("bull");
import { JobData } from "../types/types";
import db from "../db/initDb";

function createJobQueue(bot: Telegraf<CustomContext>) {
  // Create queue
  const queue = new Bull<JobData>("notify-user-queue", {
    redis: {
      host: "redis-queue-db",
    },
  });

  // Job completed event
  queue.on("completed", async (job) => {
    console.log(`✅ Message sent to ${job.data.chatId}`);
    await job.remove();
  });

  // Consumer
  queue.process(async (job) => {
    const { chatId, file, captionMsg, fileName } = job.data;

    try {
      if (!file || !fileName) {
        await bot.telegram.sendMessage(chatId, captionMsg, {
          parse_mode: "HTML",
        });
      } else {
        const fileBuffer = Buffer.from(file as string, "base64");
        await bot.telegram.sendDocument(
          chatId,
          {
            source: fileBuffer,
            filename: fileName,
          },
          { caption: captionMsg, parse_mode: "HTML" }
        );
      }
    } catch (error: any) {
      console.log(error);
      if (error instanceof TelegramError) {
        if (error.code === 429) {
          const retryAfter = error.parameters?.retry_after!;
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000 + 2000)
          );
          await job.retry();
        } else if (error.code === 403) {
          try {
            const usersRef = db.collection("subscribedUsers");
            await usersRef.doc(chatId.toString()).delete();
            // This apparently has some issues
            // TODO: Fix later
            await job.remove();
          } catch (error) {
            console.log(error);
          }
        }
      }
    }
  });

  return queue;
}

export default createJobQueue;
