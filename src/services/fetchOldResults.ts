import { axios } from "api/axiosInstance";
import { PUBLISHED_RESULTS_URL } from "constants/constants";
import { PublishedResultData } from "types/types";
import ServerError from "errors/ServerError";
import DataNotFoundError from "errors/DataNotFoundError";
import NodeCache = require("node-cache");

const COURSES_REGEX: Record<string, string> = {
  "\\bb\\.? ?tech": "btech",
  "\\bm\\.? ?tech": "mtech",
  "\bmcas*((?:twos*year|2s*year))": "mcaTwoYear",
  "\bmcas*((?:seconds*years*direct))": "mcaSecondYearDirect",
  "\bmcas*integrated\b": "mcaIntegrated",
  "\\bmca\\b": "mca",
  "\\bphd\\b": "phd",
  "\\bb\\.? ?des": "bdes",
  "\\bmba\\b": "mba",
  "\\bb\\. ?arch": "barch",
  "\\bm\\.? ?arch": "march",
  "\\bb\\.? ?voc": "bvoc",
  "\\bm\\.? ?plan": "mplan",
  "hotel management": "hmct",
  "\\bbhmct": "hmct",
  "\\bmhm\\b": "mhm",
};

const COURSES: Record<string, string> = {
  btech: "B.Tech",
  mtech: "M.Tech",
  mcaTwoYear: "MCA (2 Year)",
  mcaSecondYearDirect: "MCA (Second Year Direct)",
  mcaIntegrated: "MCA Dual degree (INTEGRATED)",
  mca: "MCA",
  phd: "PhD",
  bdes: "B.Des",
  mba: "MBA",
  barch: "B.Arch",
  march: "M.Arch",
  bvoc: "B.Voc",
  mplan: "M.Plan",
  hmct: "Hotel Management & Catering Technology",
  mhm: "MHM",
};

async function fetchAllOldResults(): Promise<PublishedResultData[]> {
  const CACHE_TTL = 24 * 60 * 60; // 24 hours

  const filteredResultsCache = new NodeCache({
    stdTTL: CACHE_TTL,
  });

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

    let responseData: PublishedResultData[] = response.data;

    if (responseData.length === 0) {
      throw new DataNotFoundError("No results found");
    }

    let filteredResponseData: PublishedResultData[] | undefined =
      filteredResultsCache.get("filteredResults");

    if (!filteredResponseData) {
      const data = responseData.map((result) => ({
        resultName: result.resultName,
        examDefId: result.examDefId,
        schemeId: result.schemeId,
        date: result.date,
      }));
      filteredResultsCache.set("filteredResults", data);
    }

    return filteredResultsCache.get("filteredResults") as PublishedResultData[];
  } catch (error: any) {
    if (error instanceof DataNotFoundError) throw error;
    throw new ServerError();
  }
}

function fetchResults(courseName: string, range: number) {}
