import got, { type ExtendOptions } from "got";
import https from "node:https";
import { API_CLIENT_OPTIONS } from "./config.js";
import {
  addKtuHeaders,
  addXTokenHeader,
  cleanGotError,
} from "./hooks/index.js";
import { createCachedApiClient } from "./cache/create-cached-client.js";
import { CACHE_CONFIG } from "./cache/config.js";

// Create a custom HTTPS agent that ignores SSL certificate errors
const agent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

// Base API client configuration (uncached, no hooks beyond base)
const baseConfig: ExtendOptions = {
  ...API_CLIENT_OPTIONS,
  agent: { https: agent },
  hooks: {
    beforeRequest: [addKtuHeaders, addXTokenHeader],
    beforeError: [cleanGotError],
    afterResponse: [],
  },
};

// Create the base API client instance (uncached)
const baseApiClient = got.extend(baseConfig);

// Create the cached API client instance
// Hot-swap: comment out the next line and uncomment the one after to disable caching
const cachedApiClient = createCachedApiClient(baseApiClient, CACHE_CONFIG);
// const cachedApiClient = baseApiClient;

export { cachedApiClient, baseApiClient };
export default cachedApiClient;
