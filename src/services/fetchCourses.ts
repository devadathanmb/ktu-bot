import { axios } from "../config/axiosConfig";
import { COURSES_URL } from "../constants/constants";
import { Course } from "../types/types";
import ServerError from "../errors/ServerError";

async function fetchCourses(): Promise<Course[]> {
  try {
    const response = await axios.post(COURSES_URL, "data=programs");

    const relevantData: Course[] = response.data.program.map(
      (course: { id: number; name: string }) => ({
        id: course.id,
        name: course.name,
      }),
    );
    return relevantData;
  } catch (error: any) {
    throw new ServerError();
  }
}

export default fetchCourses;
