import { KTU_API_ORIGIN_URL, KTU_API_REFERER_URL } from "../constants/api.js";

// API headers
const KTU_API_HEADERS = {
  "Content-Type": "application/json",
  "Accept": "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.5",
  "Accept-Encoding": "gzip, deflate, br, zstd",
  "Sec-GPC": "1",
  "Connection": "keep-alive",
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-site",
  "Origin": KTU_API_ORIGIN_URL,
  "Referer": KTU_API_REFERER_URL,
};

// API Client options
const API_CLIENT_OPTIONS = {
  timeout: { request: 20 * 1000 },
  retry: { limit: 2 },
};

export { KTU_API_HEADERS, API_CLIENT_OPTIONS };
