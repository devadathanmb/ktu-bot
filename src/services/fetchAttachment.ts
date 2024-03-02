import { axios } from "@/config/axiosConfig";
import { ATTACHMENT_URL } from "@/constants/constants";
import ServerError from "@/errors/ServerError";

async function fetchAttachment(encryptId: string): Promise<any> {
  try {
    const response = await axios.post(ATTACHMENT_URL, {
      encryptId: encryptId,
    });
    return response.data;
  } catch (error: any) {
    throw new ServerError();
  }
}

export default fetchAttachment;
