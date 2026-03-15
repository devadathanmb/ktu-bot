import { KTU_API_HEADERS } from "../../config.js";
import type { BeforeRequestHook } from "got";
import generateRandomUserAgent from "../../utils/user-agent.js";
import { KTU_API_BASE_URI } from "../../../constants/api.js";

// Hook to add KTU-specific headers to requests
export const addKtuHeaders: BeforeRequestHook = options => {
  if (options.url && options.url.toString().includes(KTU_API_BASE_URI)) {
    options.headers = {
      ...options.headers,
      ...KTU_API_HEADERS,
      "User-Agent": generateRandomUserAgent(),
    };
  }
};
