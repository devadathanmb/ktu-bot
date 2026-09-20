import { z } from "zod";
import { cachedApiClient } from "../../client.js";
import { KTU_API_ENDPOINTS } from "../../../constants/api.js";
import { withKtuErrorMapper } from "./ktu-error-mapper.js";

const AttachmentResponseSchema = z
  .string()
  .min(1, "Attachment data cannot be empty");

async function _fetchAttachment(encryptId: string): Promise<string> {
  const payload = {
    encryptId: encryptId,
  };

  const response = await cachedApiClient.post(KTU_API_ENDPOINTS.ATTACHMENT, {
    json: payload,
    responseType: "text" as const,
  });

  return AttachmentResponseSchema.parse(response.body);
}

export const fetchAttachment = withKtuErrorMapper(
  "fetchAttachment",
  _fetchAttachment
);
