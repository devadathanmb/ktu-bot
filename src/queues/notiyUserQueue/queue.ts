import { TelegramError } from "telegraf";
import { Queue } from "bullmq";
import { Worker } from "bullmq";
import { JobData } from "types/types";
import db from "@/firebase/firestore";
import bot from "bot";
import IORedis from "ioredis";

const connection = new IORedis({
  host: "redis-queue-db",
  maxRetriesPerRequest: null,
});

const queue = new Queue<JobData>("notify-user-queue", { connection });

// If there is any issue with initializing the queue, stop the bot and exit the process
queue.on("error", (err: any) => {
  if (
    (err.hasOwnProperty("code") && err.code === "ECONNREFUSED") ||
    err.code === "ENOTFOUND"
  ) {
    console.error("Redis server is not running");
    process.exit(1);
  }
});

const worker = new Worker<JobData, number>(
  "notify-user-queue",
  async (job) => {
    const { chatId, fileLink, captionMsg, fileName } = job.data;

    try {
      if (!fileLink || !fileName) {
        await bot.telegram.sendMessage(chatId, captionMsg, {
          parse_mode: "HTML",
        });
      } else {
        await bot.telegram.sendDocument(chatId, fileLink, {
          caption: captionMsg,
          parse_mode: "HTML",
        });
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
        } else {
          console.log(error);
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
