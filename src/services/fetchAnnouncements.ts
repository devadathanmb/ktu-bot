import { axios } from "api/axiosInstance";
import { ANOUNCEMENTS_URL } from "constants/constants";
import { Announcement } from "types/types";
import ServerError from "errors/ServerError";
import { stripHtml } from "string-strip-html";
import formatDate from "utils/formatDate";

async function fetchAnnouncements(
  pageNumber: number,
  dataSize: number,
  searchText = ""
): Promise<Announcement[]> {
  try {
    const payload = {
      number: pageNumber,
      size: dataSize,
      searchText,
    };
    const response = await axios.post(ANOUNCEMENTS_URL, payload, {
      cache: {
        ttl: 1000 * 60 * 5,
      },
    });

    const relevantData = response.data.content.map((obj: any) => ({
      id: obj.id,
      subject: obj.subject ? stripHtml(obj.subject).result : obj.subject,
      message: obj.message ? stripHtml(obj.message).result : obj.message,
      date: formatDate(obj.announcementDate.split(" ")[0]),
      attachments: obj.attachmentList.map((attachment: any) => ({
        name: attachment.attachmentName,
        encryptId: attachment.encryptId,
      })),
    }));

    return relevantData;
  } catch (error: any) {
    console.log(error);
    throw new ServerError();
  }
}

export default fetchAnnouncements;
