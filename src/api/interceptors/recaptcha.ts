import { InternalCacheRequestConfig } from "axios-cache-interceptor";
import { BASE_URL } from "@/constants/constants";
import Logger from "@/utils/logger";
import { axios } from "../axiosInstance";
import { BypassData, getBypassData } from "../utils/getBypassData";
import { getXToken } from "../utils/getXToken";

const logger = Logger.getLogger("INTERCEPTOR");
let bypassData: BypassData | null = null;

const recaptchaInterceptor = async (config: InternalCacheRequestConfig) => {
  if (config.url?.includes(BASE_URL)) {
    // Check if request is already cached, if so don't generate a new key
    const key = axios.generateKey(config);
    const cached = await axios.storage.get(key);

    if (cached.data) {
      logger.debug(
        `${config.url} Request already cached, skipping recaptcha bypass`
      );
      return config;
    }

    // Ensure bypassData is up-to-date and valid
    if (!bypassData) {
      logger.debug("Bypass data not found, fetching new data");
      bypassData = await getBypassData();
    }

    // Function to refresh the bypass data and get a new X token
    const refreshBypassDataAndToken = async () => {
      logger.debug(`Refreshing bypass data and getting new token`);
      bypassData = await getBypassData();
      const xToken = await getXToken(bypassData as BypassData);
      return xToken;
    };

    let xToken = await getXToken(bypassData as BypassData);

    // If X token is empty, refresh bypass data and get a new token
    if (!xToken?.x_token) {
      logger.debug(`X token is empty, refreshing data`);
      xToken = await refreshBypassDataAndToken();
    }

    // Set the X token in the request headers
    config.headers["X-Token"] = xToken?.x_token;
  }
  return config;
};

export default recaptchaInterceptor;
