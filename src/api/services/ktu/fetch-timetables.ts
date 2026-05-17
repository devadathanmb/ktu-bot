import { stripHtml } from "string-strip-html";
import { z } from "zod";
import { cachedApiClient } from "../../client.js";
import { KTU_API_ENDPOINTS } from "../../../constants/api.js";
import { formatDateToReadableString } from "../../../utils/formatting.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import type { ExamTimeTable } from "../../../types/service.types.js";
import type { Got } from "got";

interface FetchExamTimetablesParams {
  pageNumber: number;
  dataSize: number;
  apiClient?: Got;
}

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
  apiClient,
}: FetchExamTimetablesParams): Promise<ExamTimeTable[]> {
  const c = apiClient ?? cachedApiClient;
  const payload = {
    number: pageNumber,
    size: dataSize,
  };

  const response = await c.post(KTU_API_ENDPOINTS.TIMETABLES, {
    json: payload,
    responseType: "json" as const,
  });

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
