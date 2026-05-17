import { z } from "zod";
import { cachedApiClient } from "../../client.js";
import { KTU_API_SERVICE_ENDPOINTS } from "../../../constants/api.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import type { SyllabusEntry } from "../../../types/service.types.js";
import type { Got } from "got";

interface FetchSyllabusParams {
  curriculumId: number;
  apiClient?: Got;
}

const SyllabusResponseSchema = z.array(
  z.object({
    attachmentId: z.number().nullable(),
    encryptAttachmentId: z.string().nullable(),
    attachmentName: z.string().nullable(),
    description: z.string().nullable(),
  })
);

async function _fetchSyllabus({
  curriculumId,
  apiClient,
}: FetchSyllabusParams): Promise<SyllabusEntry[]> {
  const c = apiClient ?? cachedApiClient;
  const response = await c.post(KTU_API_SERVICE_ENDPOINTS.GET_SYLLABUS, {
    json: { curriculumId },
    responseType: "json" as const,
  });

  const data = SyllabusResponseSchema.parse(response.body);

  return data.map(s => ({
    attachmentId: s.attachmentId,
    encryptAttachmentId: s.encryptAttachmentId,
    attachmentName: s.attachmentName,
    description: s.description,
  }));
}

export const fetchSyllabus = withServiceWrapper(
  "fetchSyllabus",
  _fetchSyllabus
);
