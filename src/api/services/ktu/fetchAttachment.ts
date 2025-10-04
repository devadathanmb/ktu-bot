import { z } from "zod";
import client from "../../client.js";
import { KTU_API_ENDPOINTS } from "../../../constants/api.js";
import { withServiceWrapper } from "../../utils/serviceWrapper.js";

// Zod schema for attachment response validation
const AttachmentResponseSchema = z
  .string()
  .min(1, "Attachment data cannot be empty");

async function _fetchAttachment(encryptId: string): Promise<string> {
  const payload = {
    encryptId: encryptId,
  };

  const response = await client.post(KTU_API_ENDPOINTS.ATTACHMENT, {
    json: payload,
    responseType: "text" as const,
  });

  // Validate response is a non-empty string
  return AttachmentResponseSchema.parse(response.body);
}

export const fetchAttachment = withServiceWrapper(
  "fetchAttachment",
  _fetchAttachment
);
