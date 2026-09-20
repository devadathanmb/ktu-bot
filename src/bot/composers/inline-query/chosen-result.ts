import { emoji } from "@grammyjs/emoji";
import type {
  AcademicCalendar,
  Announcement,
  ExamTimeTable,
} from "../../../types/service.types.js";
import type { AttachmentDeliveryJob } from "../../../workers/attachment-delivery/queue.js";
import { getSearchTypeFromPrefix } from "./query.js";
import {
  AttachmentInfo,
  SPECIAL_RESULT_PREFIXES,
  SearchType,
} from "./search-types.js";

// Narrow record lookups, not repositories or factories: the caller decides
// how and when a record is loaded, and the resolver never constructs anything.
export interface ChosenResultDeps {
  getAnnouncementById: (id: number) => Promise<Announcement | undefined>;
  getCalendarById: (id: number) => Promise<AcademicCalendar | undefined>;
  getTimetableById: (id: number) => Promise<ExamTimeTable | undefined>;
}

export type ChosenResultResource =
  | "announcement"
  | "academic calendar"
  | "exam timetable";

// Terminal messages travel with the outcome so the exact user-facing text
// stays in one place; the composer only performs the send.
export type ChosenResultResolution =
  | { status: "ignored" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      attachments: AttachmentInfo[];
      resource: ChosenResultResource;
    };

// Result IDs are `<prefix>_<id>`; the id must be the complete, nonnegative,
// safe integer that a repository accepts, so malformed ids never reach a
// lookup.
function parseResultId(
  resultId: string
): { prefix: string; id: number } | null {
  const match = /^([^_]+)_(\d+)$/.exec(resultId);
  if (!match) return null;

  const [, prefix, rawId] = match;
  if (!prefix || !rawId) return null;

  const id = Number(rawId);
  if (!Number.isSafeInteger(id)) return null;

  return { prefix, id };
}

export async function resolveChosenResultAttachments(
  resultId: string,
  deps: ChosenResultDeps
): Promise<ChosenResultResolution> {
  // help items already have keyboards
  if (
    resultId.startsWith(SPECIAL_RESULT_PREFIXES.HELP) ||
    resultId.startsWith(SPECIAL_RESULT_PREFIXES.NO_RESULTS)
  ) {
    return { status: "ignored" };
  }

  const parsed = parseResultId(resultId);
  if (!parsed) {
    return {
      status: "error",
      message: `${emoji("cross_mark")} Invalid result format.`,
    };
  }

  const searchType = getSearchTypeFromPrefix(parsed.prefix);

  if (!searchType) {
    return {
      status: "error",
      message: `${emoji("cross_mark")} Unknown resource type.`,
    };
  }

  switch (searchType) {
    case SearchType.ANNOUNCEMENTS: {
      const announcement = await deps.getAnnouncementById(parsed.id);

      if (!announcement) {
        return {
          status: "error",
          message: `${emoji("cross_mark")} Announcement not found.`,
        };
      }

      if (announcement.attachments.length === 0) {
        return {
          status: "error",
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
      const calendar = await deps.getCalendarById(parsed.id);

      if (!calendar) {
        return {
          status: "error",
          message: `${emoji("cross_mark")} Academic calendar not found.`,
        };
      }

      return {
        status: "ready",
        attachments: [
          { name: calendar.attachmentName, encryptId: calendar.encryptId },
        ],
        resource: "academic calendar",
      };
    }
    case SearchType.TIMETABLES: {
      const timetable = await deps.getTimetableById(parsed.id);

      if (!timetable) {
        return {
          status: "error",
          message: `${emoji("cross_mark")} Exam timetable not found.`,
        };
      }

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
        status: "error",
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
