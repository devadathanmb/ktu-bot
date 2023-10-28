import * as cron from "node-cron";
import { Firestore } from "firebase-admin/firestore";
import { Telegraf } from "telegraf";
import { CustomContext } from "../types/customContext.type";
import fetchAnnouncements from "../services/fetchAnnouncements";
import { readFile, writeFile } from "fs";
import fetchAttachment from "../services/fetchAttachment";
import { Announcement, Attachment } from "../types/types";

async function notifyUserCron(db: Firestore, bot: Telegraf<CustomContext>) {
  console.log("Cron job created");
  cron.schedule("*/1 * * * *", async () => {
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

          for (const announcement of diff) {
            const attachments = announcement.attachments.map(
              (attachment: Attachment) => ({
                name: attachment.name,
                encryptId: attachment.encryptId,
              }),
            );
            attachments.forEach(async (attachment: Attachment) => {
              const file = await fetchAttachment(attachment.encryptId);
              const fileBuffer = Buffer.from(file, "base64");
              const usersRef = db.collection("subscribedUsers");
              const snapshot = await usersRef.get();

              const sendMessagePromises: Promise<any>[] = [];
              snapshot.forEach((doc) => {
                const chatId = doc.data().chatId;
                sendMessagePromises.push(
                  bot.telegram
                    .sendDocument(chatId, {
                      source: fileBuffer,
                      filename: attachment.name,
                    })
                    .catch((err) => {
                      console.error(
                        `Error sending message to chatId ${chatId}:`,
                        err,
                      );
                    }),
                );
              });
              await Promise.all(sendMessagePromises);
            });
          }
        }
      }
    });
    console.log("Finshed running cron job");
  });
}

export default notifyUserCron;
