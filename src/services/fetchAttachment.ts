import axios from "axios";
import * as https from "https";
import { ATTACHMENT_URL } from "../constants/constants";
import InvalidDataError from "../errors/InvalidDataError";
import ServerError from "../errors/ServerError";

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
  } catch (error: any) {
    if (error.response) {
      if (error.response.status === 400 || error.response.status === 500) {
        throw new InvalidDataError();
      } else if (error.response.status > 500) {
        throw new ServerError();
      }
    }
    throw new ServerError();
  }
}

export default fetchAttachment;
