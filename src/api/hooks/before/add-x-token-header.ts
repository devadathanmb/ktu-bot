import type { BeforeRequestHook } from "got";
import logger from "../../../utils/logger.js";
import { KTU_API_BASE_URI } from "../../../constants/api.js";
import { TokenSolverConfig } from "../../../configs/token-solver.js";

interface TokenSolverResponse {
  token?: string;
}

/**
 * Adds an X-Token to every KTU API request.
 *
 * KTU moved from reCAPTCHA to Cloudflare Turnstile, whose tokens are
 * single-use, so this fetches a fresh token from the solver for each request
 * instead of reusing one from shared storage.
 */
export const addXTokenHeader: BeforeRequestHook = async options => {
  if (!options.url || !options.url.toString().includes(KTU_API_BASE_URI)) {
    return;
  }

  try {
    const response = await fetch(`${TokenSolverConfig.URL}/token`, {
      signal: AbortSignal.timeout(TokenSolverConfig.TIMEOUT_MS),
    });

    if (!response.ok) {
      throw new Error(`Token solver responded with status ${response.status}`);
    }

    const body = (await response.json()) as TokenSolverResponse;
    if (!body.token) {
      throw new Error("Token solver returned an empty token");
    }

    options.headers = {
      ...options.headers,
      "X-Token": body.token,
    };
  } catch (error: unknown) {
    logger.error(error, "Error fetching X-Token");
  }
};
