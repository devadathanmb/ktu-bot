import { axios } from "api/axiosInstance";
import { RESULT_URL } from "constants/constants";
import InvalidDataError from "errors/InvalidDataError";
import { ResultDetails, ResultSummary } from "types/types";
import ServerError from "errors/ServerError";
import logger from "@/utils/logger";

async function fetchResult(
  dob: string,
  regisNo: string,
  token: string
): Promise<{ summary: ResultSummary; resultDetails: ResultDetails[] }> {
  try {
    const payload = {
      registerNo: regisNo,
      dateOfBirth: dob,
      token: token,
    };

    if (!token) {
      throw new InvalidDataError(
        "Invalid course or result choosen. Please try again."
      );
    }

    if (!dob || !regisNo) {
      throw new InvalidDataError(
        "Invalid DOB or register number. Please try again."
      );
    }

    const response = await axios.post(RESULT_URL, payload);

    if (!response.data || !response.data.resultDetails) {
      throw new InvalidDataError(
        "Invalid DOB or register number. Please try again."
      );
    }

    const resultDetails: ResultDetails[] = response.data.resultDetails.map(
      ({ courseName, grade, credits }: ResultDetails) => ({
        courseName,
        grade,
        credits,
      })
    );
    const fullName = response.data.fullName;
    const branch = response.data.branchName;
    const semester = response.data.semesterName;
    const registrerNo = response.data.registerNo;
    const institutionName = response.data.institutionName;
    const resultName = response.data.resultName;

    const summary: ResultSummary = {
      fullName,
      branch,
      semester,
      registrerNo,
      institutionName,
      resultName,
    };

    return { summary, resultDetails };
  } catch (error: any) {
    logger.error(`[SERVICE] Error in fetchResult: ${error}`);
    if (error instanceof InvalidDataError) {
      throw new InvalidDataError(error.message);
    }
    if (error.response) {
      if (
        error.response.status === 400 ||
        (error.response.status === 500 &&
          error.response.data?.message === "Index 0 out of bounds for length 0")
      ) {
        throw new InvalidDataError(
          "Invalid DOB or register number. Please try again."
        );
      } else if (error.response.status >= 500) {
        throw new ServerError();
      }
    }
    throw new ServerError();
  }
}

export { fetchResult };
