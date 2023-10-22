import axios from "axios";
import * as https from "https";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const API_URL = "https://api.ktu.edu.in/ktu-web-service/anon/result";

async function fetchPublishedResults(courseId: number) {
  try {
    const response = await axios.post(
      API_URL,
      { program: courseId },
      {
        httpsAgent: agent,
      },
    );
    const relevantData: [] = response.data.map(
      ({
        id,
        resultName,
        publishedData,
        examDefId,
        schemeId,
      }: {
        id: number;
        resultName: string;
        publishedData: string;
        examDefId: number;
        schemeId: number;
      }) => ({
        id,
        resultName,
        publishedData,
        examDefId,
        schemeId,
      }),
    );
    if (relevantData.length === 0) {
      throw "No results published yet for this course";
    }
    return relevantData;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw "Something wrong with KTU servers right now";
  }
}

export default fetchPublishedResults;
