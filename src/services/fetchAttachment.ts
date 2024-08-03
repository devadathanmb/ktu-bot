import { axios } from "api/axiosInstance";
import { ATTACHMENT_URL } from "constants/constants";
import ServerError from "errors/ServerError";
import logger from "@/utils/logger";

async function fetchAttachment(encryptId: string): Promise<any> {
  try {
    const response = await axios.post(
      ATTACHMENT_URL,
      {
        encryptId: encryptId,
      },
      {
        timeout: 15 * 1000,
      }
    );
    return response.data;
  } catch (error: any) {
    logger.error(`Error in fetchAttachment: ${error}`);
    throw new ServerError();
  }
}

export default fetchAttachment;
