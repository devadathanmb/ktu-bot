import { z } from "zod";
import got from "got";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import { CATBOX_API } from "../../../constants/api.js";
import type { TempFileUploadParams } from "../../../types/service.types.js";
import { readFileAsBuffer } from "../../../utils/file-utils.js";

const CatboxResponseSchema = z
  .url("Invalid URL returned from Catbox API")
  .startsWith("https://", "Response must be a secure HTTPS URL");

async function _uploadTempFile(params: TempFileUploadParams): Promise<string> {
  const { filePath, fileName } = params;

  const fileBuffer = await readFileAsBuffer(filePath);

  // Create native FormData instance (got v15 requires native Web API FormData)
  const form = new FormData();
  form.append("reqtype", "fileupload");
  form.append("fileToUpload", new Blob([fileBuffer]), fileName || "file");

  const response = await got.post(CATBOX_API.UPLOAD_ENDPOINT, {
    body: form,
    responseType: "text", // Catbox returns plain text URI
  });

  // Validate and return the URI using Zod
  const uri = response.body.trim();
  return CatboxResponseSchema.parse(uri);
}

export const uploadTempFile = withServiceWrapper(
  "uploadTempFile",
  _uploadTempFile
);
