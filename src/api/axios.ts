import Axios from "axios";
import { setupCache } from "axios-cache-interceptor";
import commonInterceptor from "./interceptors/common";
import recaptchaInterceptor from "./interceptors/recaptcha";

const axios = setupCache(Axios, {
  methods: ["post"],
  ttl: 1000 * 60 * 20,
});

axios.defaults.timeout = 1000 * 10;

// Inteceptors
axios.interceptors.request.use(commonInterceptor);
axios.interceptors.request.use(recaptchaInterceptor);

export { axios };
