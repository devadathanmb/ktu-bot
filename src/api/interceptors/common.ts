import { ORIGIN_URL, BASE_URL } from "@/constants/constants";
import { InternalCacheRequestConfig } from "axios-cache-interceptor";
import * as https from "https";

const agent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

const commonInterceptor = (config: InternalCacheRequestConfig) => {
  config.httpsAgent = agent;
  if (config.url?.includes(BASE_URL)) {
    config.headers["Origin"] = ORIGIN_URL;
    config.headers["Referer"] = ORIGIN_URL;
    config.headers["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  }
  return config;
};

export default commonInterceptor;
