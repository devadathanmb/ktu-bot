import { axios } from "api/axiosInstance";
import { PUBLISHED_RESULTS_URL } from "constants/constants";
import { PublishedResultData } from "types/types";
import ServerError from "errors/ServerError";
import DataNotFoundError from "errors/DataNotFoundError";
import NodeCache = require("node-cache");

// Fetching old results is possible only due to a bug in the KTU API
// The KTU API returns all the results when the program is empty
// So we can fetch all the results and filter them based on the course name
// This is a bandwidth intensive operation, and the filter process can be CPU intensive
// Thus we cache everything for 24 hours

const CACHE_TTL = 24 * 60 * 60; // 24 hours

const resultsCache = new NodeCache({
  stdTTL: CACHE_TTL,
  useClones: false,
});

const COURSES_REGEX: Record<string, string> = {
  "\\bb\\.? ?tech": "btech",
  "\\b(m\\.? ?tech)\\b(?![^\\(]*\\))": "mtech",
  "\\bmca\\s*\\(?(?:two\\s*years?|2\\s*years?)\\)?": "mcaTwoYear",
  "\\bmca\\s*\\(?(?:second\\s*years?\\s*direct)\\)?": "mcaSecondYearDirect",
  "\\bmca\\s*integrated\b": "mcaIntegrated",
  "\\bmca\\b(?![\\s\\S]*(?:\\b(?:two\\s*year|2\\s*year|second\\s*years*direct|integrated)\\b))":
    "mca",
  "\\bphd\\b": "phd",
  "\\bb\\.? ?des": "bdes",
  "\\bmba\\b": "mba",
  "\\bb\\. ?arch": "barch",
  "\\bm\\.? ?arch": "march",
  "\\bb\\.? ?voc": "bvoc",
  "\\bm\\.? ?plan": "mplan",
  "\\bbhmct": "hmct",
  "\\bmhm\\b": "mhm",
};

async function fetchAllOldResults(): Promise<PublishedResultData[]> {
  try {
    const response = await axios.post(
      PUBLISHED_RESULTS_URL,
      {
        program: "",
      },
      {
        cache: {
          // TTL is one day
          ttl: CACHE_TTL,
        },
      }
    );

    let responseData: PublishedResultData[] = response.data.reverse();

    if (responseData.length === 0) {
      throw new DataNotFoundError("No results found");
    }

    let filteredResponseData: PublishedResultData[] | undefined =
      resultsCache.get("filteredResults");

    if (!filteredResponseData) {
      const data = responseData.map((result) => ({
        resultName: result.resultName,
        token: result.token,
        publishDate: result.publishDate,
      }));
      resultsCache.set("filteredResults", data);
    }

    return resultsCache.get("filteredResults") as PublishedResultData[];
  } catch (error: any) {
    if (error instanceof DataNotFoundError) throw error;
    throw new ServerError();
  }
}

function fetchOldResults(courseName: string, page: number) {
  // Coursename will be a key in COURSES_REGEX
  // So match all the results that matches this regex string
  const PAGE_SIZE = 10;
  const data: PublishedResultData[] | undefined = resultsCache.get(courseName);
  if (data) {
    return data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }

  const courseRegex = Object.keys(COURSES_REGEX).find(
    (key) => COURSES_REGEX[key] === courseName
  )!;

  const filteredResults = resultsCache.get(
    "filteredResults"
  ) as PublishedResultData[];
  const matchedResults = filteredResults.filter((result) => {
    return new RegExp(courseRegex, "i").test(result.resultName);
  });
  resultsCache.set(courseName, matchedResults);
  return matchedResults.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
}

export { fetchAllOldResults, fetchOldResults };
