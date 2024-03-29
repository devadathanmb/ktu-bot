import { axios } from "api/axiosInstance";
import { PUBLISHED_RESULTS_URL } from "constants/constants";
import { PublishedResultData } from "types/types";
import ServerError from "errors/ServerError";
import DataNotFoundError from "errors/DataNotFoundError";

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

    responseData = responseData.map((result) => ({
      resultName: result.resultName,
      examDefId: result.examDefId,
      schemeId: result.schemeId,
      publishDate: result.publishDate,
    }));

    // TODO: Remove this when the API is fixed
    // This is a temporary fix for the API last 10 data
    // Fix would be to create a wrapper API that runs a cron which fetches the data from the original API and then returns the data
    if (courseId === 1) {
      responseData.push({
        resultName: "B.Tech S6 (R, S) Exam June 2023 (2019 Scheme)",
        examDefId: 894,
        schemeId: 17,
      });
    }

    return responseData;
  } catch (error: any) {
    if (error instanceof DataNotFoundError) throw error;
    throw new ServerError();
  }
}

export default fetchPublishedResults;
