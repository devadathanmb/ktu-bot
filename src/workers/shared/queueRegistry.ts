import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { dataSyncQueue } from "../data-sync/queue.js";
import { announcementsNotifyQueue } from "../announcements/notify/queue.js";
import { broadcastsQueue } from "../broadcasts/worker.js";

// Central registry of all BullMQ queues with their Bull Board adapters
// This provides a single source of truth for monitoring
export const queueAdapters = [
  new BullMQAdapter(dataSyncQueue),
  new BullMQAdapter(announcementsNotifyQueue),
  new BullMQAdapter(broadcastsQueue),
];
