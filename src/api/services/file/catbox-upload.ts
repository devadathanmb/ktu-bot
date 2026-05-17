import { z } from "zod";
import got from "got";
import { withServiceWrapper } from "../../utils/service-wrapper.js";
import { CATBOX_API } from "../../../constants/api.js";
import type { TempFileUploadParams } from "../../../types/service.types.js";
import {
  readFileAsBuffer,
  createTempFileFromBase64,
  withTempFileCleanup,
} from "../../../utils/file-utils.js";

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

// Helper function to upload base64 data
async function _uploadBase64Data(
  base64Data: string,
  fileName: string
): Promise<string> {
  const tempFilePath = await createTempFileFromBase64(base64Data, fileName);

  return withTempFileCleanup(tempFilePath, async () => {
    return _uploadTempFile({
      filePath: tempFilePath,
      fileName,
    });
  });
}

export const uploadTempFile = withServiceWrapper(
  "uploadTempFile",
  _uploadTempFile
);

export const uploadBase64File = withServiceWrapper(
  "uploadBase64File",
  _uploadBase64Data
);
