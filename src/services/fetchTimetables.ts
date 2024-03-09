import { axios } from "config/axiosConfig";
import { TIMETABLE_URL } from "constants/constants";
import { Timetable } from "types/types";
import ServerError from "errors/ServerError";
import formatDate from "utils/formatDate";

async function fetchTimetables(
  pageNumber: number,
  dataSize: number
): Promise<Timetable[]> {
  try {
    const payload = {
      number: pageNumber,
      size: dataSize,
    };
    const response = await axios.post(TIMETABLE_URL, payload);

    const relevantData = response.data.content.map((obj: any) => ({
      id: obj.id,
      title: obj.timeTableTitle,
      encryptId: obj.encryptId,
      attachmentId: obj.attachmentId,
      date: formatDate(obj.modifiedDate.split("T")[0]),
      fileName: obj.fileName,
    }));

    return relevantData;
  } catch (error: any) {
    throw new ServerError();
  }
}

export default fetchTimetables;
