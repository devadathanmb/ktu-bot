import { axios } from "api/axios";
import { ATTACHMENT_URL } from "constants/constants";
import ServerError from "errors/ServerError";
import Logger from "@/utils/logger";

const logger = Logger.getLogger("FETCH_SERVICE");

async function fetchAttachment(encryptId: string): Promise<any> {
  try {
    const response = await axios.post(
      ATTACHMENT_URL,
      {
        encryptId: encryptId,
      },
      {
        timeout: 15 * 1000,
        cache: {
          ttl: 1000 * 60 * 60 * 2,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    logger.error(`Error in fetchAttachment: ${error}`);
    throw new ServerError();
  }
}

export default fetchAttachment;
