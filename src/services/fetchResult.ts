import { axios } from "api/axiosInstance";
import { RESULT_URL } from "constants/constants";
import InvalidDataError from "errors/InvalidDataError";
import { ResultDetails, ResultSummary } from "types/types";
import ServerError from "errors/ServerError";

async function fetchResult(
  dob: string,
  regisNo: string,
  examDefId: number,
  schemeId: number
): Promise<{ summary: ResultSummary; resultDetails: ResultDetails[] }> {
  try {
    const payload = {
      registerNo: regisNo,
      dateOfBirth: dob,
      examDefId: examDefId,
      schemeId: schemeId,
    };

    if (!examDefId || !schemeId) {
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

    const resultDetails: ResultDetails[] = response.data.resultDetails.map(
      ({ courseName, grade, credits }: ResultDetails) => ({
        courseName,
        grade,
        credits,
      })
    );

    const firstName = response.data.firstName;
    const lastName = response.data.surName;
    const middleName = response.data.middleName;
    const branch = response.data.branchName;
    const semester = response.data.semesterName;
    const registrerNo = response.data.registerNo;
    const institutionName = response.data.institutionName;
    const resultName = response.data.resultName;

    const summary: ResultSummary = {
      firstName,
      lastName,
      middleName,
      branch,
      semester,
      registrerNo,
      institutionName,
      resultName,
    };

    return { summary, resultDetails };
  } catch (error: any) {
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
