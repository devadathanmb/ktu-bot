import axios from "axios";
import * as https from "https";
import { PUBLISHED_RESULTS_URL } from "../constants/constants";
import { PublishedResultData } from "../types/types";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

async function fetchPublishedResults(
  courseId: number,
): Promise<PublishedResultData[]> {
  try {
    const response = await axios.post(
      PUBLISHED_RESULTS_URL,
      { program: courseId },
      {
        httpsAgent: agent,
      },
    );

    const responseData: PublishedResultData[] = response.data;

    if (responseData.length === 0) {
      throw "No results published yet for this course";
    }

    return responseData;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw new Error("Something wrong with KTU servers right now");
  }
}

export default fetchPublishedResults;
