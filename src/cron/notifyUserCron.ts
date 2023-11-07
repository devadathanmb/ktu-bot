import * as cron from "node-cron";
import { Firestore } from "firebase-admin/firestore";
import { Telegraf } from "telegraf";
import { CustomContext } from "../types/customContext.type";
import fetchAnnouncements from "../services/fetchAnnouncements";
import { readFile, writeFile } from "fs";
import fetchAttachment from "../services/fetchAttachment";
import { Announcement, Attachment } from "../types/types";

// This is a hacky way to do this
// Will need to use some kind of queing mechanism in the future
const batchSize = 25;
const delayBetweenBatches = 2000;

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

            for (let i = 0; i < diff.length; i += batchSize) {
              const batch = diff.slice(i, i + batchSize);

              await Promise.all(
                batch.map(async (announcement) => {
                  const captionMsg = `
                  <b>Subject:</b> ${announcement.subject}
                  <b>Date:</b> ${announcement.date}
                  <b>Message:</b> ${announcement.message}
                `;

                  const attachments = announcement.attachments.map(
                    (attachment: Attachment) => ({
                      name: attachment.name,
                      encryptId: attachment.encryptId,
                    }),
                  );

                  await Promise.all(
                    attachments.map(async (attachment: Attachment) => {
                      const file = await fetchAttachment(attachment.encryptId);
                      const fileBuffer = Buffer.from(file, "base64");
                      const usersRef = db.collection("subscribedUsers");
                      const snapshot = await usersRef.get();

                      await Promise.all(
                        snapshot.docs.map(async (doc) => {
                          const chatId = doc.data().chatId;
                          await bot.telegram
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
                            });
                        }),
                      );
                    }),
                  );
                }),
              );
              await new Promise((resolve) =>
                setTimeout(resolve, delayBetweenBatches),
              );
            }
          }
        } catch (error) {
          console.log(error);
        }
      }
    });
    console.log("Finished running cron job");
  });
}

export default notifyUserCron;
