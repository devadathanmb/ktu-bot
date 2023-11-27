import * as cron from "node-cron";
import { Firestore } from "firebase-admin/firestore";
import { Telegraf, TelegramError } from "telegraf";
import { CustomContext } from "../types/customContext.type";
import fetchAnnouncements from "../services/fetchAnnouncements";
import { readFile, writeFile } from "fs";
import fetchAttachment from "../services/fetchAttachment";
import { Announcement, Attachment } from "../types/types";

// Telegram API only allows 30 messages per second
// So to be safe, we will send 25 messages per second
// And wait 1 minute between batches
// This will not block the bot from receiving messages since everything is asynchronous
const batchSize = 25;
const delayBetweenBatches = 1000 * 60;

async function notifyUserCron(db: Firestore, bot: Telegraf<CustomContext>) {
  console.log("Cron job initialized");
  cron.schedule("*/10 * * * *", async () => {
    const startTime = new Date().toString();
    console.log(`🔴 Cron job started at ${startTime}`);
    readFile("data.json", "utf8", async (err, data) => {
      if (err?.code == "ENOENT") {
        const announcements = JSON.stringify(await fetchAnnouncements(0, 10));
        writeFile("data.json", announcements, "utf8", (err) => {
          if (err) {
            console.error(err);
          }
        });
      } else {
        const announcements: Announcement[] = await fetchAnnouncements(0, 10);
        const previousAnnouncements: Announcement[] = JSON.parse(data);
        let diff: Announcement[] = [];

        // hacky way to compare if both are equal :)
        if (
          JSON.stringify(announcements) !==
          JSON.stringify(previousAnnouncements)
        ) {
          const previousAnnouncementIds = new Set(
            previousAnnouncements.map((a: Announcement) => a.id),
          );
          diff = announcements.filter(
            (announcement: Announcement) =>
              !previousAnnouncementIds.has(announcement.id),
          );
          writeFile(
            "data.json",
            JSON.stringify(announcements),
            "utf8",
            (err) => {
              if (err) {
                console.error(err);
              }
            },
          );

          // Get all the chatIds
          const usersRef = db.collection("subscribedUsers");
          const snapshot = await usersRef.get();
          const chatIds = snapshot.docs.map((doc) => doc.data().chatId);

          // Loop through each new annoucement
          for (const announcement of diff) {
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
              }),
            );

            // For each attachment, fetch the annoucement, send the attachment to each chatIds in batches
            attachments.forEach(async (attachment: Attachment) => {
              const file = await fetchAttachment(attachment.encryptId);
              const fileBuffer = Buffer.from(file, "base64");

              // Send the attachment in batches
              for (let i = 0; i < chatIds.length; i += batchSize) {
                console.log(
                  `🔴 Sending batch ${i / batchSize + 1} at ${new Date()}`,
                );

                // Get the current batch
                const batch = chatIds.slice(i, i + batchSize);
                let batchPromises: Promise<any>[] = [];

                // Push each sendDocument promise to the batchPromises array
                batch.forEach((chatId) => {
                  batchPromises.push(
                    bot.telegram
                      .sendDocument(
                        chatId,
                        {
                          source: fileBuffer,
                          filename: attachment.name,
                        },
                        { caption: captionMsg, parse_mode: "HTML" },
                      )
                      .catch(async (err: TelegramError) => {
                        // If the user has blocked the bot, or the account is deleted
                        // or the bot was removed from the group
                        // then remove the chatid from the database
                        // because this leads to bot slowing down
                        if (err.code === 403) {
                          console.log(
                            `🔴 Telegram Error: 403. Removing chatId ${chatId} from database`,
                          );
                          try {
                            await usersRef.doc(chatId.toString()).delete();
                          } catch (error) {
                            console.log(error);
                          }
                        }
                      }),
                  );
                });

                // Wait for the batch to finish sending
                await Promise.all(batchPromises);

                // Log the batch stats
                console.log(
                  `🔴 Batch ${batch} finished sending at ${new Date()}`,
                );
                console.log(`🔴 Successfully sent to ${batch.length} users`);

                // Wait for the delay between batches
                await new Promise((resolve) =>
                  setTimeout(resolve, delayBetweenBatches),
                );
              }
            });
          }
        }
      }
    });
  });
}

export default notifyUserCron;
