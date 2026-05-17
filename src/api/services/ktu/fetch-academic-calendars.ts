import { stripHtml } from "string-strip-html";
import { z } from "zod";
import { cachedApiClient } from "../../client.js";
import { KTU_API_ENDPOINTS } from "../../../constants/api.js";
import { formatDateToReadableString } from "../../../utils/formatting.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import type { AcademicCalendar } from "../../../types/service.types.js";
import type { Got } from "got";

interface FetchAcademicCalendarsParams {
  pageNumber: number;
  dataSize: number;
  apiClient?: Got;
}

// Zod schema for API response validation with transformations
const AcademicCalendarResponseSchema = z.object({
  content: z.array(
    z.object({
      id: z.number(),
      academicCalendarTitle: z
        .string()
        .optional()
        .transform(title => stripHtml(title || "").result),
      modifiedDate: z.string().transform(date => new Date(date)),
      attachmentName: z.string(),
      attachmentId: z.number(),
      encryptAttachmentId: z.string(),
    })
  ),
});

async function _fetchAcademicCalendars({
  pageNumber,
  dataSize,
  apiClient,
}: FetchAcademicCalendarsParams): Promise<AcademicCalendar[]> {
  const c = apiClient ?? cachedApiClient;
  const payload = {
    number: pageNumber,
    size: dataSize,
  };

  const response = await c.post(KTU_API_ENDPOINTS.ACADEMIC_CALENDAR, {
    json: payload,
    responseType: "json" as const,
  });

  // Validate API response with Zod
  const data = AcademicCalendarResponseSchema.parse(response.body);

  const calendars: AcademicCalendar[] = data.content.map(obj => ({
    id: obj.id,
    title: obj.academicCalendarTitle,
    publishedAt: obj.modifiedDate,
    formattedPublishedDate: formatDateToReadableString(obj.modifiedDate),
    attachmentName: obj.attachmentName,
    attachmentId: obj.attachmentId,
    encryptId: obj.encryptAttachmentId,
  }));

  return calendars;
}

// Export the wrapped version with error handling
export const fetchAcademicCalendars = withServiceWrapper(
  "fetchAcademicCalendars",
  _fetchAcademicCalendars
);
