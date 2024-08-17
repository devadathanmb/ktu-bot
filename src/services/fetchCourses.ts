import { axios } from "api/axios";
import { COURSES_URL } from "constants/constants";
import { Course } from "types/types";
import ServerError from "errors/ServerError";
import Logger from "@/utils/logger";

const logger = Logger.getLogger("FETCH_SERVICE");

async function fetchCourses(): Promise<Course[]> {
  try {
    const response = await axios.post(COURSES_URL, "data=programs", {
      cache: {
        // This route is not expected to change frequently
        // So we can cache it for a long time
        ttl: 1000 * 60 * 60 * 2,
      },
    });

    const relevantData: Course[] = response.data.program.map(
      (course: { id: number; name: string }) => ({
        id: course.id,
        name: course.name,
      })
    );
    return relevantData;
  } catch (error: any) {
    logger.error(`Error in fetchCourses: ${error}`);
    throw new ServerError();
  }
}

export default fetchCourses;
