import { axios, agent } from "../config/axiosConfig";
import { ANOUNCEMENTS_URL } from "../constants/constants";
import { Announcement } from "../types/types";
import ServerError from "../errors/ServerError";

async function fetchAnnouncements(
  pageNumber: number,
  dataSize: number,
): Promise<Announcement[]> {
  try {
    const payload = {
      number: pageNumber,
      size: dataSize,
      searchText: "",
    };
    const response = await axios.post(ANOUNCEMENTS_URL, payload, {
      httpsAgent: agent,
    });

    const relevantData = response.data.content.map((obj: any) => ({
      id: obj.id,
      subject: obj.subject,
      date: obj.announcementDate,
      attachments: obj.attachmentList.map((attachment: any) => ({
        name: attachment.attachmentName,
        encryptId: attachment.encryptId,
      })),
    }));

    return relevantData;
  } catch (error: any) {
    throw new ServerError();
  }
}

export default fetchAnnouncements;
