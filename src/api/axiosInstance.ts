import Axios from "axios";
import { setupCache } from "axios-cache-interceptor";
import { BASE_URL } from "@/constants/constants";
import * as https from "https";

const agent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

const axios = setupCache(Axios, {
  methods: ["post"],
  ttl: 1000 * 60 * 10,
});

// KTU servers are known to be slow during high traffic
// By default, axios has no timeout, which means it can take forever to get a response
// This causes Telegraf to timeout as well as Telegram servers to re-try the request leading to duplication which again may fail due to timeout
// Hence it is best to assume that we will not get a response after 10 seconds and cancel the request
axios.defaults.timeout = 1000 * 10;

axios.interceptors.request.use((config) => {
  config.httpsAgent = agent;
  if (config.url?.includes(BASE_URL)) {
    config.headers["Origin"] = process.env.ORIGIN_URL;
    config.headers["Referer"] = process.env.ORIGIN_URL;
    config.headers["User-Agent"] =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
  }
  return config;
});

export { axios };
