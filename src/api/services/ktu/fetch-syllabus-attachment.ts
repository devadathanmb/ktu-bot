import { cachedApiClient } from "../../client.js";
import { KTU_API_SERVICE_ENDPOINTS } from "../../../constants/api.js";
import { withKtuErrorMapper } from "./ktu-error-mapper.js";
import logger from "../../../utils/logger.js";
import type { Got } from "got";
import type { AttachmentResponseConsumer } from "./fetch-attachment.js";

const SYLLABUS_ATTACHMENT_TIMEOUT_MS = 60 * 1000;

interface FetchSyllabusAttachmentParams {
  encryptId: string;
  apiClient?: Got;
  consumeResponse: AttachmentResponseConsumer;
}

async function _fetchSyllabusAttachment({
  encryptId,
  apiClient,
  consumeResponse,
}: FetchSyllabusAttachmentParams): Promise<void> {
  const c = apiClient ?? cachedApiClient;
  const payload = { encryptId };

  logger.debug(
    { encryptId, endpoint: "getAttachments" },
    "Fetching syllabus attachment"
  );

  const response = c.stream.post(
    KTU_API_SERVICE_ENDPOINTS.SYLLABUS_ATTACHMENT,
    {
      json: payload,
      timeout: { request: SYLLABUS_ATTACHMENT_TIMEOUT_MS },
    }
  );

  try {
    await consumeResponse(response);
  } finally {
    response.destroy();
  }
}

export const fetchSyllabusAttachment = withKtuErrorMapper(
  "fetchSyllabusAttachment",
  _fetchSyllabusAttachment
);
