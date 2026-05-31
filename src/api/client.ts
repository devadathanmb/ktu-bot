import got, { type ExtendOptions } from "got";
import { API_CLIENT_OPTIONS } from "./config.js";
import {
  addKtuHeaders,
  addXTokenHeader,
  cleanGotError,
} from "./hooks/index.js";
import { createCachedApiClient } from "./cache/create-cached-client.js";
import { CACHE_CONFIG } from "./cache/config.js";

const baseConfig: ExtendOptions = {
  ...API_CLIENT_OPTIONS,
  hooks: {
    beforeRequest: [addKtuHeaders, addXTokenHeader],
    beforeError: [cleanGotError],
    afterResponse: [],
  },
  responseType: "json" as const,
};

const baseApiClient = got.extend(baseConfig);

const cachedApiClient = createCachedApiClient(baseApiClient, CACHE_CONFIG);

export { cachedApiClient, baseApiClient };
