import Axios from "axios";
import { setupCache } from "axios-cache-interceptor";
import { ORIGIN_URL, BASE_URL } from "@/constants/constants";
import * as https from "https";
import { getBypassData, BypassData } from "./getBypassData";
import { getXToken } from "./getXToken";

const agent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

const axios = setupCache(Axios, {
  methods: ["post"],
  ttl: 1000 * 60 * 10,
});

let bypassData: BypassData | null = null;

axios.defaults.timeout = 1000 * 10;

// Common headers interceptor
axios.interceptors.request.use((config) => {
  config.httpsAgent = agent;
  if (config.url?.includes(BASE_URL)) {
    config.headers["Origin"] = ORIGIN_URL;
    config.headers["Referer"] = ORIGIN_URL;
    config.headers["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  }
  return config;
});

// Recaptcha interceptor
axios.interceptors.request.use(async (config) => {
  if (config.url?.includes(BASE_URL)) {
    // Ensure bypassData is up-to-date and valid
    if (!bypassData) {
      bypassData = await getBypassData();
    }

    // Function to refresh the bypass data and get a new X token
    const refreshBypassDataAndToken = async () => {
      bypassData = await getBypassData();
      const xToken = await getXToken(bypassData as BypassData);
      return xToken;
    };

    let xToken = await getXToken(bypassData as BypassData);

    // If X token is empty, refresh bypass data and get a new token
    if (!xToken?.x_token) {
      xToken = await refreshBypassDataAndToken();
    }

    // Set the X token in the request headers
    config.headers["X-Token"] = xToken?.x_token;
  }
  return config;
});

export { axios };
