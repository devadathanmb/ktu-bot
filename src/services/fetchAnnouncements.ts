import { axios } from "@/config/axiosConfig";
import { ANOUNCEMENTS_URL } from "@/constants/constants";
import { Announcement } from "@/types/types";
import ServerError from "@/errors/ServerError";
import formatDate from "@/utils/formatDate";

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
      subject: obj.subject,
      message: obj.message,
      date: formatDate(obj.announcementDate.split(" ")[0]),
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
