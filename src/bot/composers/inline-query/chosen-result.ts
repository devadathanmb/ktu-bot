import { emoji } from "@grammyjs/emoji";
import { AcademicCalendarsRepository } from "../../../db/repositories/academic-calendars-repository.js";
import { AnnouncementsRepository } from "../../../db/repositories/announcements-repository.js";
import { ExamTimetablesRepository } from "../../../db/repositories/exam-timetables-repository.js";
import type { AttachmentDeliveryJob } from "../../../workers/attachment-delivery/queue.js";
import { getSearchTypeFromPrefix } from "./query.js";
import {
  AttachmentInfo,
  SPECIAL_RESULT_PREFIXES,
  SearchType,
} from "./search-types.js";

export interface ChosenResultRepos {
  announcements: Pick<AnnouncementsRepository, "getById">;
  calendars: Pick<AcademicCalendarsRepository, "getById">;
  timetables: Pick<ExamTimetablesRepository, "getById">;
}

export type ChosenResultResource =
  | "announcement"
  | "academic calendar"
  | "exam timetable";

// Terminal messages travel with the outcome so the exact user-facing text
// stays in one testable place; the composer only performs the send.
export type ChosenResultResolution =
  | { status: "ignored" }
  | { status: "invalid-format"; message: string }
  | { status: "unknown-type"; message: string }
  | { status: "not-found"; message: string }
  | { status: "no-attachments"; message: string }
  | {
      status: "ready";
      attachments: AttachmentInfo[];
      resource: ChosenResultResource;
    };

export async function resolveChosenResultAttachments(
  resultId: string,
  repos: ChosenResultRepos
): Promise<ChosenResultResolution> {
  // help items already have keyboards
  if (
    resultId.startsWith(SPECIAL_RESULT_PREFIXES.HELP) ||
    resultId.startsWith(SPECIAL_RESULT_PREFIXES.NO_RESULTS)
  ) {
    return { status: "ignored" };
  }

  const [prefix, id] = resultId.split("_");

  if (!prefix || !id) {
    return {
      status: "invalid-format",
      message: `${emoji("cross_mark")} Invalid result format.`,
    };
  }

  const searchType = getSearchTypeFromPrefix(prefix);

  if (!searchType) {
    return {
      status: "unknown-type",
      message: `${emoji("cross_mark")} Unknown resource type.`,
    };
  }

  switch (searchType) {
    case SearchType.ANNOUNCEMENTS: {
      const dbAnnouncement = await repos.announcements.getById(Number(id));

      if (!dbAnnouncement) {
        return {
          status: "not-found",
          message: `${emoji("cross_mark")} Announcement not found.`,
        };
      }

      const announcement =
        AnnouncementsRepository.transformToApi(dbAnnouncement);
      if (announcement.attachments.length === 0) {
        return {
          status: "no-attachments",
          message: `${emoji("information")} No attachments found for this announcement.`,
        };
      }
      return {
        status: "ready",
        attachments: announcement.attachments,
        resource: "announcement",
      };
    }
    case SearchType.CALENDARS: {
      const dbCalendar = await repos.calendars.getById(Number(id));

      if (!dbCalendar) {
        return {
          status: "not-found",
          message: `${emoji("cross_mark")} Academic calendar not found.`,
        };
      }

      const calendar = AcademicCalendarsRepository.transformToApi(dbCalendar);
      return {
        status: "ready",
        attachments: [
          { name: calendar.attachmentName, encryptId: calendar.encryptId },
        ],
        resource: "academic calendar",
      };
    }
    case SearchType.TIMETABLES: {
      const dbTimetable = await repos.timetables.getById(Number(id));

      if (!dbTimetable) {
        return {
          status: "not-found",
          message: `${emoji("cross_mark")} Exam timetable not found.`,
        };
      }

      const timetable = ExamTimetablesRepository.transformToApi(dbTimetable);
      if (timetable.fileName && timetable.encryptId) {
        return {
          status: "ready",
          attachments: [
            { name: timetable.fileName, encryptId: timetable.encryptId },
          ],
          resource: "exam timetable",
        };
      }
      return {
        status: "no-attachments",
        message: `${emoji("information")} No attachments found for this exam timetable.`,
      };
    }
  }
}

export function buildAttachmentDeliveryJob(
  chatId: number,
  attachments: AttachmentInfo[],
  statusMessageId: number
): AttachmentDeliveryJob {
  return {
    chatId: chatId,
    attachments: attachments,
    statusMessageId: statusMessageId,
    context: "inline query result",
  };
}
