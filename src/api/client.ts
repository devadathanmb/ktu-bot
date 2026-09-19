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
    beforeRequest: [addKtuHeaders],
    beforeError: [cleanGotError],
    afterResponse: [],
  },
  responseType: "json" as const,
};

// Header-only client. The token hook is attached after the cache hook so a
// cached response short-circuits before a single-use Turnstile token is spent.
const headersApiClient = got.extend(baseConfig);

// Uncached client for workers that need fresh KTU data: mints a token per call.
const baseApiClient = headersApiClient.extend({
  hooks: {
    beforeRequest: [addXTokenHeader],
  },
});

const cachedApiClient = createCachedApiClient(
  headersApiClient,
  CACHE_CONFIG
).extend({
  hooks: {
    beforeRequest: [addXTokenHeader],
  },
});

export { cachedApiClient, baseApiClient };
