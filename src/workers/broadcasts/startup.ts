import { BroadcastsWorker } from "./worker.js";
import { broadcastsQueue } from "./queue.js";
import { BroadcastsWorkerConfig } from "../../configs/broadcasts-worker.js";
import { startWorkerService } from "../shared/start-worker.js";

void startWorkerService({
  WorkerClass: BroadcastsWorker,
  queue: broadcastsQueue,
  serviceName: "broadcasts-worker",
  port: BroadcastsWorkerConfig.HEALTHCHECK_PORT,
});
