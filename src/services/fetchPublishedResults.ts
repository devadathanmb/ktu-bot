import { axios } from "api/axiosInstance";
import { PUBLISHED_RESULTS_URL } from "constants/constants";
import { PublishedResultData } from "types/types";
import ServerError from "errors/ServerError";
import DataNotFoundError from "errors/DataNotFoundError";
import Logger from "@/utils/logger";

const logger = new Logger("FETCH_SERVICE");

async function fetchPublishedResults(
  courseId: number
): Promise<PublishedResultData[]> {
  try {
    const response = await axios.post(PUBLISHED_RESULTS_URL, {
      program: courseId,
    });

    let responseData: PublishedResultData[] = response.data;

    if (responseData.length === 0) {
      throw new DataNotFoundError(
        "No results have been published for this course yet."
      );
    }

    responseData = responseData.map((result, index) => ({
      resultName: result.resultName,
      token: result.token,
      publishDate: result.publishDate,
      index: index + 1,
    }));

    return responseData;
  } catch (error: any) {
    logger.error(`Error in fetchPublishedResults: ${error}`);
    if (error instanceof DataNotFoundError) throw error;
    throw new ServerError();
  }
}

export default fetchPublishedResults;
