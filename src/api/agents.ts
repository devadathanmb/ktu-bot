import https from "node:https";

// KTU's API certificate chain is unreliable in practice. Keep this exception
// scoped to KTU requests instead of disabling TLS verification for every
// external API call made by the shared Got client.
export const ktuHttpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
});
