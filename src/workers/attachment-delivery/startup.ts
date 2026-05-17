import { AttachmentDeliveryWorker } from "./worker.js";
import { attachmentDeliveryQueue } from "./queue.js";
import { AttachmentDeliveryWorkerConfig } from "../../configs/attachment-delivery-worker.js";
import { startWorkerService } from "../shared/start-worker.js";

void startWorkerService({
  WorkerClass: AttachmentDeliveryWorker,
  queue: attachmentDeliveryQueue,
  serviceName: "attachment-delivery-worker",
  port: AttachmentDeliveryWorkerConfig.ATTACHMENT_DELIVERY_WORKER_HEALTHCHECK_PORT,
});
