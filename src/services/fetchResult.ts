import axios from "axios";
import * as https from "https";
import { RESULT_URL } from "../constants/constants";
import InvalidDataError from "../errors/InvalidDataError";
import { ResultDetails, ResultSummary } from "../types/types";
import ServerError from "../errors/ServerError";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

async function fetchResult(
  dob: string,
  regisNo: string,
  examDefId: number,
  schemeId: number,
): Promise<{ summary: ResultSummary; resultDetails: ResultDetails[] }> {
  try {
    const payload = {
      registerNo: regisNo,
      dateOfBirth: dob,
      examDefId: examDefId,
      schemeId: schemeId,
    };

    const response = await axios.post(RESULT_URL, payload, {
      httpsAgent: agent,
    });

    const resultDetails: ResultDetails[] = response.data.resultDetails.map(
      ({ courseName, grade, credits }: ResultDetails) => ({
        courseName,
        grade,
        credits,
      }),
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

export { fetchResult };
