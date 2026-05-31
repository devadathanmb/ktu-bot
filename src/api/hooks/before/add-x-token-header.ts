import got, { type BeforeRequestHook } from "got";
import logger from "../../../utils/logger.js";
import { KTU_API_BASE_URI, KTU_API_ENDPOINTS } from "../../../constants/api.js";
import { API_CLIENT_OPTIONS, KTU_API_HEADERS } from "../../config.js";
import { ktuHttpsAgent } from "../../agents.js";
import generateRandomUserAgent from "../../utils/user-agent.js";

const recaptchaClient = got.extend({
  ...API_CLIENT_OPTIONS,
  agent: { https: ktuHttpsAgent },
  headers: {
    ...KTU_API_HEADERS,
    "User-Agent": generateRandomUserAgent(),
  },
});

// This hook is to add X-Token in the KTU API requests
// XToken only needs to be added if recaptcha is enabled
export const addXTokenHeader: BeforeRequestHook = async options => {
  if (
    options.url &&
    options.url.toString().includes(KTU_API_BASE_URI) &&
    !options.url.toString().includes(KTU_API_ENDPOINTS.RECAPTCHA_SCRIPT)
  ) {
    try {
      const response = await recaptchaClient.post(
        KTU_API_ENDPOINTS.RECAPTCHA_SCRIPT,
        {
          responseType: "json",
        }
      );
      const data = response.body as { key?: string; script?: string };

      if (data.key != null || data.script != null) {
        options.headers = {
          ...options.headers,
          "X-Token": "",
        };
      }
    } catch (error: unknown) {
      logger.error(error, "Error fetching X-Token");
    }
  }
};
