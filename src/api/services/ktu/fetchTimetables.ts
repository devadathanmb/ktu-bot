import { stripHtml } from "string-strip-html";
import { z } from "zod";
import client from "../../client.js";
import { KTU_API_ENDPOINTS } from "../../../constants/api.js";
import { formatDateToReadableString } from "../../../utils/formatting.js";
import { withServiceWrapper } from "../../utils/serviceWrapper.js";
import type { ExamTimeTable } from "../../../types/service.types.js";

interface FetchExamTimetablesParams {
  pageNumber: number;
  dataSize: number;
}

// Zod schema for API response validation with transformations
const ExamTimetableResponseSchema = z.object({
  content: z.array(
    z.object({
      id: z.number(),
      timeTableTitle: z
        .string()
        .optional()
        .transform(title => stripHtml(title || "").result),
      encryptId: z.string().nullable(),
      attachmentId: z.number().nullable(),
      modifiedDate: z.string().transform(date => new Date(date)),
      fileName: z.string().nullable(),
    })
  ),
});

async function _fetchExamTimetables({
  pageNumber,
  dataSize,
}: FetchExamTimetablesParams): Promise<ExamTimeTable[]> {
  const payload = {
    number: pageNumber,
    size: dataSize,
  };

  const response = await client.post(KTU_API_ENDPOINTS.TIMETABLES, {
    json: payload,
    responseType: "json" as const,
  });

  // Validate API response with Zod
  const data = ExamTimetableResponseSchema.parse(response.body);

  const timetables: ExamTimeTable[] = data.content.map(obj => ({
    id: obj.id,
    title: obj.timeTableTitle,
    encryptId: obj.encryptId,
    attachmentId: obj.attachmentId,
    publishedAt: obj.modifiedDate || null,
    formattedPublishedDate: formatDateToReadableString(obj.modifiedDate),
    fileName: obj.fileName,
  }));

  return timetables;
}

export const fetchTimetables = withServiceWrapper(
  "fetchTimetables",
  _fetchExamTimetables
);
