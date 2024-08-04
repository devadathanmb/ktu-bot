import { axios } from "../axiosInstance";
import Logger from "@/utils/logger";

const logger = Logger.getLogger("BYPASS_CAPTCHA");

const BYPASS_DATA_URL = "http://captcha-bypass:3000/bypass_captcha";

interface BypassData {
  anchor: string;
  reload: string;
  payload: string;
}

async function getBypassData(): Promise<BypassData | null> {
  try {
    logger.debug("Fetching captcha bypass data");
    const response = await axios.get(BYPASS_DATA_URL, {
      cache: false,
    });
    return response.data;
  } catch (error) {
    logger.error(`Error while fetching captcha bypass data: ${error}`);
    return null;
  }
}

export { getBypassData, BypassData };
