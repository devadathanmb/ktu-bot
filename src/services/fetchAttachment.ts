import { axios } from "api/axiosInstance";
import { ATTACHMENT_URL } from "constants/constants";
import ServerError from "errors/ServerError";

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
    throw new ServerError();
  }
}

export default fetchAttachment;
