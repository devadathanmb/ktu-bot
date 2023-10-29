import axios from "axios";
import * as https from "https";
import { PUBLISHED_RESULTS_URL } from "../constants/constants";
import { PublishedResultData } from "../types/types";
import ServerError from "../errors/ServerError";
import InvalidDataError from "../errors/InvalidDataError";
import DataNotFoundError from "../errors/DataNotFoundError";

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
      throw new DataNotFoundError(
        "No results have been published for this course yet.",
      );
    }

    return responseData;
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

export default fetchPublishedResults;
