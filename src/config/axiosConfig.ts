import Axios from "axios";
import { setupCache } from "axios-cache-interceptor";
import * as https from "https";

const agent = new https.Agent({
  rejectUnauthorized: false,
});

const axios = setupCache(Axios, {
  methods: ["post"],
  ttl: 1000 * 60 * 10,
});

// KTU servers are known to be slow during high traffic
// This results in telegram api timing out on their end due no response
axios.defaults.timeout = 1000 * 30;

axios.interceptors.request.use((config) => {
  config.httpsAgent = agent;
  return config;
});

export { axios };
