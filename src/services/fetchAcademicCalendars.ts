import { axios } from "api/axiosInstance";
import { ACADEMIC_CALENDAR_URL } from "constants/constants";
import { AcademicCalendar } from "types/types";
import ServerError from "errors/ServerError";
import formatDate from "utils/formatDate";
import { stripHtml } from "string-strip-html";
import Logger from "@/utils/logger";

const logger = Logger.getLogger("FETCH_SERVICE");

async function fetchAcademicCalendars(
  pageNumber: number,
  dataSize: number
): Promise<AcademicCalendar[]> {
  try {
    const payload = {
      number: pageNumber,
      size: dataSize,
    };
    const response = await axios.post(ACADEMIC_CALENDAR_URL, payload);

    const relevantData = response.data.content.map((obj: any) => ({
      id: obj.id,
      title: stripHtml(obj.academicCalendarTitle || "").result,
      date: formatDate(obj.modifiedDate.split("T")[0]),
      attachmentName: obj.attachmentName,
      attachmentId: obj.attachmentId,
      encryptId: obj.encryptAttachmentId,
    }));

    return relevantData;
  } catch (error: any) {
    logger.error(`Error in fetchAcademicCalendars: ${error}`);
    throw new ServerError();
  }
}

export default fetchAcademicCalendars;
