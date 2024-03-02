import * as cron from "node-cron";
import fetchAnnouncements from "@services/fetchAnnouncements";
import { readFile, writeFile } from "fs";
import fetchAttachment from "@/services/fetchAttachment";
import { Announcement, Attachment, JobData } from "@/types/types";
import findFilters from "@/utils/findFilters";
import getCaptionMsg from "@/utils/getCaptionMsg";
import db from "@/db/initDb";
import getRelevancy from "@/services/getRelevancy";
import queue from "@/queues/notiyUserQueue/queue";

// Type of the notification job in the notification job queue
interface NotifJobs {
  name: string;
  data: JobData;
  opts: {
    removeOnComplete: boolean;
    removeOnFail: boolean;
  };
}

async function notifyUserCron() {
  console.log("Cron job initialized");
  cron.schedule("*/15 * * * *", async () => {
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
              // If no filters were matched, check if it is relevant or not first
              // If it is relevant, send to all users
              // If not relevant send to users with ALL filter only
              if (filters.length === 1 && filters[0] === "general") {
                const relevancy = await getRelevancy(announcement.subject);
                console.log(
                  `➡️  Announcement : ${announcement.subject} Relevancy : ${relevancy}`
                );
                if (relevancy) {
                  snapshot = await usersRef.get();
                } else {
                  snapshot = await usersRef
                    .where("courseFilter", "==", "all")
                    .get();
                }
              } else {
                // If already matched by a course filter, then it is definitely relevant
                // So send it to all users with the course filter, ALL filter and relevant filter
                snapshot = await usersRef
                  .where("courseFilter", "in", [...filters, "all", "relevant"])
                  .get();
              }

              const chatIds = snapshot.docs.map((doc) => doc.data().chatId);

              // If there are no chatIds for this filter, then skip this announcement
              if (chatIds.length === 0) {
                continue;
              }

              // Get the caption message
              const captionMsg = getCaptionMsg(announcement);

              // Get the data to fetch the attachments
              const attachments = announcement.attachments.map(
                (attachment: Attachment) => ({
                  name: attachment.name,
                  encryptId: attachment.encryptId,
                })
              );

              // Add stuff to the queue
              // Pass fileBuffer as null since there are no attachments
              if (attachments.length === 0) {
                const name = `msg-${captionMsg.slice(5)}`;
                let jobs: NotifJobs[] = [];
                for (let i = 0; i < chatIds.length; i++) {
                  jobs.push({
                    name: name,
                    data: {
                      chatId: chatIds[i],
                      captionMsg: captionMsg,
                      fileName: null,
                      file: null,
                    },
                    opts: {
                      removeOnComplete: true,
                      removeOnFail: true,
                    },
                  });
                }
                try {
                  await queue.addBulk(jobs);
                } catch (error) {
                  console.error(error);
                }
              } else {
                // Loop through each attachment and add to the queue
                let jobs: NotifJobs[] = [];
                for (let i = 0; i < attachments.length; i++) {
                  const file = await fetchAttachment(attachments[i].encryptId);
                  const name = `msg-${captionMsg.slice(5)}-attach-${i}`;
                  for (let j = 0; j < chatIds.length; j++) {
                    jobs.push({
                      name: name,
                      data: {
                        chatId: chatIds[j],
                        file: file,
                        captionMsg: captionMsg,
                        fileName: attachments[i].name,
                      },
                      opts: {
                        removeOnComplete: true,
                        removeOnFail: true,
                      },
                    });
                  }
                }
                try {
                  await queue.addBulk(jobs);
                } catch (error) {
                  console.error(error);
                }
              }
            }
          }
        } catch (error) {
          console.error(error);
        }
      }
    });
  });
}

export default notifyUserCron;
