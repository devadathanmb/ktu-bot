import Axios from "axios";
import { setupCache } from "axios-cache-interceptor";
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
  return config;
});

export { axios };
