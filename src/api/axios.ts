import Axios from "axios";
import { setupCache } from "axios-cache-interceptor";
import commonInterceptor from "./interceptors/common";

const axios = setupCache(Axios, {
  methods: ["post"],
  ttl: 1000 * 60 * 30,
});

axios.defaults.timeout = 1000 * 10;

// Inteceptors
axios.interceptors.request.use(commonInterceptor);

export { axios };
