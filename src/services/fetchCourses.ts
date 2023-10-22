import axios from "axios";
import * as https from "https";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const API_URL = "https://api.ktu.edu.in/ktu-web-service/anon/masterData";

async function fetchCourses() {
  try {
    const response = await axios.post(API_URL, "data=programs", {
      httpsAgent: agent,
    });
    const relevantData: { id: number; name: string }[] =
      response.data.program.map(
        ({ id, name }: { id: number; name: string }) => ({
          id,
          name,
        }),
      );
    return relevantData;
  } catch (error) {
    console.error("Error fetching data:", error);
    throw "Something wrong with KTU servers right now";
  }
}

export default fetchCourses;
