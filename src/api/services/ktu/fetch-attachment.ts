import type { Readable } from "node:stream";
import { cachedApiClient } from "../../client.js";
import { KTU_API_ENDPOINTS } from "../../../constants/api.js";
import { withKtuErrorMapper } from "./ktu-error-mapper.js";

export type AttachmentResponseConsumer = (response: Readable) => Promise<void>;

async function _fetchAttachment(
  encryptId: string,
  consumeResponse: AttachmentResponseConsumer
): Promise<void> {
  const response = cachedApiClient.stream.post(KTU_API_ENDPOINTS.ATTACHMENT, {
    json: { encryptId },
  });

  try {
    await consumeResponse(response);
  } finally {
    response.destroy();
  }
}

export const fetchAttachment = withKtuErrorMapper(
  "fetchAttachment",
  _fetchAttachment
);
