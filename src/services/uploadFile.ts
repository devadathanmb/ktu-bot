import { storage } from "firebase-admin";
import { writeFile, unlink } from "node:fs/promises";

const bucket = storage().bucket();

async function uploadFile(fileBase64: string, fileName: string) {
  try {
    // Save the file as a temp file in /tmp
    const tempFilePath = `/tmp/${fileName}`;
    await writeFile(tempFilePath, fileBase64, "base64");

    // Uplaod the temp file to the firebase storage
    await bucket.upload(tempFilePath, {
      destination: fileName,
      public: true,
    });

    // Get a signed url
    const [url] = await bucket.file(fileName).getSignedUrl({
      action: "read",
      expires: Date.now() + 1 * 60 * 60 * 1000,
    });

    // Remove the temp file
    await unlink(tempFilePath);

    return url;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

export default uploadFile;
