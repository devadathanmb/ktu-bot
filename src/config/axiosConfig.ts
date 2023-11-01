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

export { axios, agent };
