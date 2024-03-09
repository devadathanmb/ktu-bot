import { TelegramError } from "telegraf";
import { Queue } from "bullmq";
import { Worker } from "bullmq";
import { JobData } from "types/types";
import db from "db/initDb";
import bot from "bot";
import IORedis from "ioredis";

const connection = new IORedis({
  host: "redis-queue-db",
  maxRetriesPerRequest: null,
});

const queue = new Queue<JobData>("notify-user-queue", { connection });

const worker = new Worker<JobData, number>(
  "notify-user-queue",
  async (job) => {
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
      return job.data.chatId;
    } catch (error: any) {
      if (error instanceof TelegramError) {
        if (error.code === 429) {
          const retryAfter = error.parameters?.retry_after!;
          await new Promise((resolve) =>
            setTimeout(resolve, retryAfter * 1000 + 2000)
          );
          await job.retry();
          return job.data.chatId;
        } else if (error.code === 403 || error.code === 400) {
          try {
            const usersRef = db.collection("subscribedUsers");
            await usersRef.doc(chatId.toString()).delete();
          } catch (error) {
            console.error(error);
          }
        }
      }
      return job.data.chatId;
    }
  },
  { connection }
);

worker.on("completed", async (_job, result) => {
  console.log(`✅ Message sent to ${result}`);
});

worker.on("failed", async (_job, err) => {
  console.error(err);
});

worker.on("error", (err) => {
  console.error(err);
});

export default queue;
