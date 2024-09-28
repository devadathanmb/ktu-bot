import { InternalCacheRequestConfig } from "axios-cache-interceptor";
import { COURSES_URL, PUBLISHED_RESULTS_URL, RESULT_URL } from "@/constants/constants";
import Logger from "@/utils/logger";
import { axios } from "../axios";
import { BypassData, getBypassData } from "../utils/getBypassData";
import { getXToken } from "../utils/getXToken";

const logger = Logger.getLogger("INTERCEPTOR");

const PROTECTED_URLS = [COURSES_URL, RESULT_URL, PUBLISHED_RESULTS_URL];

const recaptchaInterceptor = async (config: InternalCacheRequestConfig) => {
  if (PROTECTED_URLS.some(url => config.url?.includes(url))) {
    // Check if request is already cached, if so don't generate a new key
    const key = axios.generateKey(config);
    const cached = await axios.storage.get(key);

    // If data is already cached and cache not overridden
    if (cached.data && config.cache) {
      logger.debug(
        `${config.url} Request already cached, skipping recaptcha bypass`
      );
      return config;
    }

    const bypassData = await getBypassData();
    const xToken = await getXToken(bypassData as BypassData);

    // Set the X token in the request headers
    config.headers["X-Token"] = xToken!.x_token;
  }
  return config;
};

export default recaptchaInterceptor;
