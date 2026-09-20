import type { BeforeRequestHook } from "got";
import { KTU_API_BASE_URI } from "../../../constants/api.js";
import { fetchToken } from "../../token-solver.js";

/**
 * Adds a fresh X-Token to every KTU API request.
 *
 * The hook only gates on the KTU base URL and attaches the token; HTTP
 * communication and response validation live in the injected minter. Solver
 * failures propagate so the request fails instead of continuing to KTU without
 * a token.
 */
export function createAddXTokenHeader(
  mintToken: () => Promise<string>
): BeforeRequestHook {
  return async options => {
    if (!options.url || !options.url.toString().includes(KTU_API_BASE_URI)) {
      return;
    }

    options.headers = {
      ...options.headers,
      "X-Token": await mintToken(),
    };
  };
}

export const addXTokenHeader = createAddXTokenHeader(fetchToken);
