import { TokenSolverConfig } from "../configs/token-solver.js";

const TOKEN_PATH = "/token";

/**
 * Fetches a fresh Cloudflare Turnstile token from the token solver.
 *
 * Turnstile tokens are single-use, so every uncached KTU request must mint its
 * own token. Any failure (timeout, network error, non-2xx response, malformed
 * JSON, or a blank token) throws so the caller never sends a KTU request
 * without an X-Token and triggers a second, misleading 401.
 *
 * The `fetchImpl` parameter exists only so tests can inject a stub; production
 * callers use the built-in fetch.
 */
export async function fetchToken(
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const url = `${TokenSolverConfig.URL}${TOKEN_PATH}`;
  const response = await fetchImpl(url, {
    signal: AbortSignal.timeout(TokenSolverConfig.TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Token solver responded with status ${response.status}`);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (error: unknown) {
    throw new Error("Token solver returned malformed JSON", { cause: error });
  }

  const token = readToken(body);
  if (!token) {
    throw new Error("Token solver returned a blank token");
  }

  return token;
}

function readToken(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;

  const token = (body as Record<string, unknown>).token;
  if (typeof token !== "string" || token.trim() === "") return undefined;

  return token;
}
