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

const agent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

const baseConfig: ExtendOptions = {
  ...API_CLIENT_OPTIONS,
  agent: { https: agent },
  hooks: {
    beforeRequest: [addKtuHeaders, addXTokenHeader],
    beforeError: [cleanGotError],
    afterResponse: [],
  },
};

const baseApiClient = got.extend(baseConfig);

const cachedApiClient = createCachedApiClient(baseApiClient, CACHE_CONFIG);

export { cachedApiClient, baseApiClient };
