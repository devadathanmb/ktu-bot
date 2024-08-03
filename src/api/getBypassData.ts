import axios from "axios";

const BYPASS_DATA_URL = "http://captcha-bypass:3000/bypass_captcha";

interface BypassData {
  anchor: string;
  reload: string;
  payload: string;
}

async function getBypassData(): Promise<BypassData | null> {
  try {
    const response = await axios.get(
      BYPASS_DATA_URL,
      // Axios cache interceptor takes over axios instance
      // So we need to disable cache here
      {
        //@ts-ignore
        cache: false,
      }
    );
    return response.data;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export { getBypassData, BypassData };
