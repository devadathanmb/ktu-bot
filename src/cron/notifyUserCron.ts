import * as cron from "node-cron";
import { Firestore } from "firebase-admin/firestore";
import { Telegraf, TelegramError } from "telegraf";
import { CustomContext } from "../types/customContext.type";
import fetchAnnouncements from "../services/fetchAnnouncements";
import { readFile, writeFile } from "fs";
import fetchAttachment from "../services/fetchAttachment";
import { Announcement, Attachment } from "../types/types";
import findFilters from "../utils/findFilters";
import Bull = require("bull");

async function notifyUserCron(db: Firestore, bot: Telegraf<CustomContext>) {
  console.log("Cron job initialized");
  cron.schedule("*/10 * * * *", async () => {
    const startTime = new Date().toString();
    console.log(`🔴 Cron job started at ${startTime}`);
    readFile("data.json", "utf8", async (err, data) => {
      if (err?.code == "ENOENT") {
        try {
          const announcements = JSON.stringify(await fetchAnnouncements(0, 10));
          writeFile("data.json", announcements, "utf8", (err) => {
            if (err) {
              console.error(err);
            }
          });
        } catch (error) {}
      } else {
        try {
          const announcements: Announcement[] = await fetchAnnouncements(0, 10);
          const previousAnnouncements: Announcement[] = JSON.parse(data);
          let diff: Announcement[] = [];

          // hacky way to compare if both are equal :)
          if (
            JSON.stringify(announcements) !==
            JSON.stringify(previousAnnouncements)
          ) {
            const previousAnnouncementIds = new Set(
              previousAnnouncements.map((a: Announcement) => a.id)
            );
            diff = announcements.filter(
              (announcement: Announcement) =>
                !previousAnnouncementIds.has(announcement.id)
            );
            writeFile(
              "data.json",
              JSON.stringify(announcements),
              "utf8",
              (err) => {
                if (err) {
                  console.error(err);
                }
              }
            );

            // Get all the chatIds
            const usersRef = db.collection("subscribedUsers");

            // Loop through each new annoucement
            for (const announcement of diff) {
              // Find the filters based on subject
              const filters = findFilters(announcement.subject);

              let snapshot: FirebaseFirestore.QuerySnapshot<FirebaseFirestore.DocumentData>;

              // Find all the chatIds that match the filters
              // If the filters is "general", then send to all users
              if (filters.length === 1 && filters[0] === "general") {
                snapshot = await usersRef.get();
              } else {
                snapshot = await usersRef
                  .where("courseFilter", "in", [...filters, "all"])
                  .get();
              }

              const chatIds = snapshot.docs.map((doc) => doc.data().chatId);

              // If there are no chatIds for this filter, then skip this announcement
              if (chatIds.length === 0) {
                continue;
              }

              const captionMsg = `

<b>Subject:</b> ${announcement.subject ? announcement.subject : "N/A"}

<b>Date:</b> ${announcement.date ? announcement.date : "N/A"}

<b>Message:</b> ${announcement.message ? announcement.message : "N/A"}
`;

              // Get the data to fetch the attachments
              const attachments = announcement.attachments.map(
                (attachment: Attachment) => ({
                  name: attachment.name,
                  encryptId: attachment.encryptId,
                })
              );

              // Create queue
              const queue = new Bull("notify-user-queue");

              // Add all the chatIds to the queue
              for (let i = 0; i < chatIds.length; i++) {
                await queue.add({
                  chatId: chatIds[i],
                });
              }

              // Consumer
              if (attachments.length === 0) {
                queue.process(async (job) => {
                  const { chatId } = job.data;
                  try {
                    await bot.telegram.sendMessage(chatId, captionMsg, {
                      parse_mode: "HTML",
                    });
                  } catch (error: any) {
                    if (error instanceof TelegramError) {
                      console.log(error);
                      if (error.code === 429) {
                        const retryAfter = error.parameters?.retry_after!;
                        await new Promise((resolve) =>
                          setTimeout(resolve, retryAfter * 1000 + 2000)
                        );
                        await job.retry();
                      } else if (error.code === 403) {
                        try {
                          await usersRef.doc(chatId.toString()).delete();
                          await job.remove();
                        } catch (error) {
                          console.log(error);
                        }
                      }
                    }
                  }
                });
              } else {
                // fetch attachments
                // send each attachment to each chatId
                for (let i = 0; i < attachments.length; i++) {
                  const file = await fetchAttachment(attachments[i].encryptId);
                  const fileBuffer = Buffer.from(file, "base64");
                  queue.process(async (job) => {
                    const chatId = job.data.chatId;
                    try {
                      await bot.telegram.sendDocument(
                        chatId,
                        {
                          source: fileBuffer,
                          filename: attachments[i].name,
                        },
                        { caption: captionMsg, parse_mode: "HTML" }
                      );
                    } catch (error: any) {
                      if (error instanceof TelegramError) {
                        console.log(error);
                        if (error.code === 429) {
                          const retryAfter = error.parameters?.retry_after!;
                          await new Promise((resolve) =>
                            setTimeout(resolve, retryAfter * 1000 + 2000)
                          );
                          await job.retry();
                        } else if (error.code === 403) {
                          try {
                            await usersRef.doc(chatId.toString()).delete();
                            await job.remove();
                          } catch (error) {
                            console.log(error);
                          }
                        }
                      }
                    }
                  });
                }
              }

              // Job completed event
              queue.on("completed", async (job) => {
                console.log(`✅ Message sent to ${job.data.chatId}`);
                await job.remove();
              });
            }
          }
        } catch (error) {
          console.log(error);
        }
      }
    });
  });
}

export default notifyUserCron;
