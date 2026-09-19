import type {
  Attachment,
  ExamTimeTable,
} from "../../../../types/service.types.js";

export function getTimetableAttachment(
  timetable: ExamTimeTable
): Attachment | null {
  const { attachmentId, fileName, encryptId } = timetable;
  if (!attachmentId || !fileName?.trim() || !encryptId?.trim()) {
    return null;
  }

  return { name: fileName, encryptId };
}
