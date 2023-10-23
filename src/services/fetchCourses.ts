import axios from "axios";
import * as https from "https";
import { COURSES_URL } from "../constants/constants";
import { Course } from "../types/types";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

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
  } catch (error) {
    console.error("Error fetching data:", error);
    throw new Error("Something wrong with KTU servers right now");
  }
}

export default fetchCourses;
