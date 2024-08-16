import { InternalCacheRequestConfig } from "axios-cache-interceptor";
import { BASE_URL } from "@/constants/constants";
import Logger from "@/utils/logger";
import { axios } from "../axiosInstance";
import { BypassData, getBypassData } from "../utils/getBypassData";
import { getXToken } from "../utils/getXToken";

const logger = Logger.getLogger("INTERCEPTOR");

const recaptchaInterceptor = async (config: InternalCacheRequestConfig) => {
  if (config.url?.includes(BASE_URL)) {
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
