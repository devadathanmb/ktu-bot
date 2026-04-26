import { z } from "zod";
import client from "../../client.js";
import { KTU_API_SERVICE_ENDPOINTS } from "../../../constants/api.js";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import logger from "../../../utils/logger.js";

const SYLLABUS_ATTACHMENT_TIMEOUT_MS = 60 * 1000;

const SyllabusAttachmentResponseSchema = z.string().min(1);

async function _fetchSyllabusAttachment(encryptId: string): Promise<string> {
  const payload = { encryptId };

  logger.debug(
    { encryptId, endpoint: "getAttachments" },
    "Fetching syllabus attachment"
  );

  const response = await client.post(
    KTU_API_SERVICE_ENDPOINTS.SYLLABUS_ATTACHMENT,
    {
      json: payload,
      responseType: "text" as const,
      timeout: { request: SYLLABUS_ATTACHMENT_TIMEOUT_MS },
    }
  );

  const rawData = SyllabusAttachmentResponseSchema.parse(response.body);

  const separatorIndex = rawData.indexOf("&&");
  let base64Data: string;
  let fileName: string | undefined;

  if (separatorIndex !== -1) {
    base64Data = rawData.substring(0, separatorIndex);
    fileName = rawData.substring(separatorIndex + 2);
  } else {
    base64Data = rawData;
  }

  logger.debug(
    {
      encryptId,
      fileName,
      fileSizeBytes: Buffer.byteLength(base64Data, "base64"),
    },
    "Syllabus attachment fetched"
  );

  return base64Data;
}

export const fetchSyllabusAttachment = withServiceWrapper(
  "fetchSyllabusAttachment",
  _fetchSyllabusAttachment
);
