import { openAsBlob } from "node:fs";
import { z } from "zod";
import got from "got";
import { CATBOX_API } from "../../../constants/api.js";
import type { TempFileUploadParams } from "../../../types/service.types.js";

const CatboxResponseSchema = z
  .url("Invalid URL returned from Catbox API")
  .startsWith("https://", "Response must be a secure HTTPS URL");

export async function uploadTempFile(
  params: TempFileUploadParams
): Promise<string> {
  const { filePath, fileName } = params;

  const form = new FormData();
  form.append("reqtype", "fileupload");
  // A file-backed Blob keeps the oversized-file fallback bounded in memory too.
  form.append("fileToUpload", await openAsBlob(filePath), fileName || "file");

  const response = await got.post(CATBOX_API.UPLOAD_ENDPOINT, {
    body: form,
    responseType: "text", // Catbox returns plain text URI
  });

  const uri = response.body.trim();
  return CatboxResponseSchema.parse(uri);
}
