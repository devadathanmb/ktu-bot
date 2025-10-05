import { type BeforeRequestHook } from "got";
import logger from "../../../utils/logger.js";
import { KTU_API_BASE_URI, KTU_API_ENDPOINTS } from "../../../constants/api.js";
import client from "../../client.js";

// This hook is to add X-Token in the KTU API requests
// XToken only needs to be added if recaptcha is enabled
export const addXTokenHeader: BeforeRequestHook = async options => {
  if (
    options.url &&
    options.url.toString().includes(KTU_API_BASE_URI) &&
    !options.url.toString().includes(KTU_API_ENDPOINTS.RECAPTCHA_SCRIPT)
  ) {
    try {
      const response = await client.post(KTU_API_ENDPOINTS.RECAPTCHA_SCRIPT, {
        responseType: "json",
        cache: false,
      });
      const data = response.body as { key?: string; script?: string };

      if (data.key != null || data.script != null) {
        options.headers = {
          ...options.headers,
          // Add XToken inspected from the API requests
          "X-Token": "",
        };
      }
    } catch (error: unknown) {
      logger.error(error, "Error fetching X-Token");
    }
  }
};
