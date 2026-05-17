import { DataSyncWorker } from "./worker.js";
import { dataSyncQueue } from "./queue.js";
import { DataSyncWorkerConfig } from "../../configs/data-sync-worker.js";
import { startWorkerService } from "../shared/start-worker.js";

void startWorkerService({
  WorkerClass: DataSyncWorker,
  queue: dataSyncQueue,
  serviceName: "data-sync-worker",
  port: DataSyncWorkerConfig.HEALTHCHECK_PORT,
});
