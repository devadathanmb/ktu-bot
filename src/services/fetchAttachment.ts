import axios from "axios";
import * as https from "https";
import { ATTACHMENT_URL } from "../constants/constants";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

async function fetchAttachment(encryptId: string): Promise<any> {
  try {
    const response = await axios.post(
      ATTACHMENT_URL,
      {
        encryptId: encryptId,
      },
      {
        httpsAgent: agent,
      },
    );
    return response.data;
  } catch (error) {
    throw new Error("Something wrong with KTU servers right now");
  }
}

export default fetchAttachment;
