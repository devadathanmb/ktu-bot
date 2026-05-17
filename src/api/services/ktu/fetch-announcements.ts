import { stripHtml } from "string-strip-html";
import { z } from "zod";
import { cachedApiClient } from "../../client.js";
import { KTU_API_ENDPOINTS } from "../../../constants/api.js";
import { formatDateToReadableString } from "../../../utils/formatting.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import type { Announcement } from "../../../types/service.types.js";
import type { Got } from "got";

interface FetchAnnouncementsParams {
  pageNumber: number;
  dataSize: number;
  searchText?: string;
  apiClient?: Got;
}

// Zod schema for API response validation with transformations
const AnnouncementResponseSchema = z.object({
  content: z.array(
    z.object({
      id: z.number(),
      subject: z
        .string()
        .nullable()
        .transform(subject => stripHtml(subject || "").result),
      message: z
        .string()
        .nullable()
        .transform(message => stripHtml(message || "").result),
      announcementDate: z.string().transform(date => new Date(date)),
      attachmentList: z.array(
        z.object({
          attachmentName: z.string(),
          encryptId: z.string(),
        })
      ),
    })
  ),
});

async function _fetchAnnouncements({
  pageNumber,
  dataSize,
  searchText = "",
  apiClient,
}: FetchAnnouncementsParams): Promise<Announcement[]> {
  const c = apiClient ?? cachedApiClient;
  const payload = {
    number: pageNumber,
    size: dataSize,
    searchText: searchText,
  };

  const response = await c.post(KTU_API_ENDPOINTS.ANNOUNCEMENTS, {
    json: payload,
    responseType: "json" as const,
  });

  // Validate API response with Zod
  const data = AnnouncementResponseSchema.parse(response.body);

  const announcements: Announcement[] = data.content.map(obj => ({
    id: obj.id,
    subject: obj.subject,
    message: obj.message,
    publishedAt: obj.announcementDate || null,
    formattedPublishedDate: formatDateToReadableString(obj.announcementDate),
    attachments: obj.attachmentList.map(attachment => ({
      name: attachment.attachmentName,
      encryptId: attachment.encryptId,
    })),
  }));

  // logger.debug({ announcements: announcements }, "Fetched announcements");

  return announcements;
}

// Export the wrapped version with error handling
export const fetchAnnouncements = withServiceWrapper(
  "fetchAnnouncements",
  _fetchAnnouncements
);
