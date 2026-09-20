import type { JobSchedulerJson, Queue } from "bullmq";

/**
 * BullMQ types `Queue` around job-shaped data, so resolve its type parameters
 * explicitly to describe a queue that carries plain job data.
 */
export type SchedulerQueue<DataType> = Queue<
  DataType,
  unknown,
  string,
  DataType,
  unknown,
  string
>;

export interface RecurringJobSchedule<DataType> {
  /**
   * Stable scheduler id. Never encode the cron pattern here: BullMQ keys
   * schedulers by this id, so a changed pattern must update the same entry.
   */
  schedulerId: string;
  jobName: string;
  data: DataType;
}

export interface RecurringSchedulesResult {
  removedLegacySchedulerIds: string[];
}

function isLegacySchedule<DataType>(
  scheduler: JobSchedulerJson<DataType>,
  schedules: readonly RecurringJobSchedule<DataType>[]
): boolean {
  return schedules.some(
    schedule =>
      schedule.jobName === scheduler.name &&
      schedule.schedulerId !== scheduler.key
  );
}

/**
 * Creates or updates one BullMQ job scheduler per logical job.
 *
 * Re-running this with a different cron pattern updates the existing scheduler
 * instead of accumulating definitions. Repeat definitions created by the
 * deprecated `queue.add(..., { repeat })` API are removed first, because
 * BullMQ keeps producing jobs for them (and converts them into schedulers keyed
 * by their legacy hash) alongside the stable schedulers. Schedulers for other
 * logical jobs are left untouched.
 */
export async function setupRecurringSchedules<DataType>(
  queue: SchedulerQueue<DataType>,
  schedules: readonly RecurringJobSchedule<DataType>[],
  pattern: string
): Promise<RecurringSchedulesResult> {
  const existingSchedulers = await queue.getJobSchedulers();
  const legacySchedulerIds = existingSchedulers
    .filter(scheduler => isLegacySchedule(scheduler, schedules))
    .map(scheduler => scheduler.key);

  await Promise.all(
    legacySchedulerIds.map(schedulerId => queue.removeJobScheduler(schedulerId))
  );

  await Promise.all(
    schedules.map(schedule =>
      queue.upsertJobScheduler(
        schedule.schedulerId,
        { pattern },
        { name: schedule.jobName, data: schedule.data }
      )
    )
  );

  return { removedLegacySchedulerIds: legacySchedulerIds };
}
