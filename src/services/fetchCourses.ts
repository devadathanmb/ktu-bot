import { axios, agent } from "../config/axiosConfig";
import { COURSES_URL } from "../constants/constants";
import { Course } from "../types/types";
import InvalidDataError from "../errors/InvalidDataError";
import ServerError from "../errors/ServerError";

async function fetchCourses(): Promise<Course[]> {
  try {
    const response = await axios.post(COURSES_URL, "data=programs", {
      httpsAgent: agent,
    });

    const relevantData: Course[] = response.data.program.map(
      (course: { id: number; name: string }) => ({
        id: course.id,
        name: course.name,
      }),
    );
    return relevantData;
  } catch (error: any) {
    if (error.response) {
      if (
        error.response.status === 400 ||
        (error.response.status === 500 &&
          error.response.data?.message !== "No message available")
      ) {
        throw new InvalidDataError();
      } else if (error.response.status >= 500) {
        throw new ServerError();
      }
    }
    throw new ServerError();
  }
}

export default fetchCourses;
