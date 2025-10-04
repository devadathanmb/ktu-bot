import got, { type ExtendOptions } from "got";
import https from "node:https";
import { API_CLIENT_OPTIONS } from "./config.js";
import { addKtuHeaders, addXTokenHeader } from "./hooks/index.js";

// Create a custom HTTPS agent that ignores SSL certificate errors
const agent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});

// Base client configuration
const baseConfig: ExtendOptions = {
  ...API_CLIENT_OPTIONS,
  agent: { https: agent },
  hooks: {
    beforeRequest: [addKtuHeaders, addXTokenHeader],
    afterResponse: [],
  },
};

// Create the regular client instance without caching
const client = got.extend(baseConfig);

export default client;
