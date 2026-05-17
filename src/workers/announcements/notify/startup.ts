import { AnnouncementsNotifyWorker } from "./worker.js";
import { announcementsNotifyQueue } from "./queue.js";
import { AnnouncementsNotifyWorkerConfig } from "../../../configs/announcements-notify-worker.js";
import { startWorkerService } from "../../shared/start-worker.js";

void startWorkerService({
  WorkerClass: AnnouncementsNotifyWorker,
  queue: announcementsNotifyQueue,
  serviceName: "announcements-notify-worker",
  port: AnnouncementsNotifyWorkerConfig.HEALTHCHECK_PORT,
});
