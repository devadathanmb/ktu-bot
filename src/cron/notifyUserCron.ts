import * as cron from "node-cron";
import { Firestore } from "firebase-admin/firestore";
import { Telegraf } from "telegraf";
import { CustomContext } from "../types/customContext.type";
import fetchAnnouncements from "../services/fetchAnnouncements";
import { readFile, writeFile } from "fs";
import fetchAttachment from "../services/fetchAttachment";
import { Announcement, Attachment } from "../types/types";

// Telegram API only allows 30 messages per second
// So to be safe, we will send 20 messages per second
// And wait 1 minute between batches
// This will not block the bot from receiving messages since everything is asynchronous
const batchSize = 20;
const delayBetweenBatches = 1000 * 60;

async function notifyUserCron(db: Firestore, bot: Telegraf<CustomContext>) {
  console.log("Cron job created");
  cron.schedule("*/20 * * * *", async () => {
    console.log("Running cron job");
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

          // Loop through each new annoucement
          for (const announcement of diff) {
            const captionMsg = `

<b>Subject:</b> ${announcement.subject}

<b>Date:</b> ${announcement.date}

<b>Message:</b> ${announcement.message}

`;

            // Get the data to fetch the attachments
            const attachments = announcement.attachments.map(
              (attachment: Attachment) => ({
                name: attachment.name,
                encryptId: attachment.encryptId,
              }),
            );

            // Get all the chatIds
            const usersRef = db.collection("subscribedUsers");
            const snapshot = await usersRef.get();
            const chatIds = snapshot.docs.map((doc) => doc.data().chatId);

            // For each attachment, fetch the annoucement, send the attachment to each chatIds in batches
            attachments.forEach(async (attachment: Attachment) => {
              const file = await fetchAttachment(attachment.encryptId);
              const fileBuffer = Buffer.from(file, "base64");

              // Send the attachment in batches
              for (let i = 0; i < chatIds.length; i += batchSize) {
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
                      .catch((err) => {
                        console.error(
                          `Error sending message to chatId ${chatId}:`,
                          err,
                        );
                      }),
                  );
                });

                // Wait for the batch to finish sending
                await Promise.all(batchPromises);

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
    console.log("Finshed running cron job");
  });
}

export default notifyUserCron;
