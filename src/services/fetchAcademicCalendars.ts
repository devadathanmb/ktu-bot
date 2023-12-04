import { axios } from "../config/axiosConfig";
import { ACADEMIC_CALENDAR_URL } from "../constants/constants";
import { AcademicCalendar } from "../types/types";
import ServerError from "../errors/ServerError";
import formatDate from "../utils/formatDate";

async function fetchAcademicCalendars(
  pageNumber: number,
  dataSize: number,
): Promise<AcademicCalendar[]> {
  try {
    const payload = {
      number: pageNumber,
      size: dataSize,
    };
    const response = await axios.post(ACADEMIC_CALENDAR_URL, payload);

    const relevantData = response.data.content.map((obj: any) => ({
      id: obj.id,
      title: obj.academicCalendarTitle,
      date: formatDate(obj.modifiedDate.split("T")[0]),
      attachmentName: obj.attachmentName,
      attachmentId: obj.attachmentId,
      encryptId: obj.encryptAttachmentId,
    }));

    return relevantData;
  } catch (error: any) {
    throw new ServerError();
  }
}

export default fetchAcademicCalendars;
