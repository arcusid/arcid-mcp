export const DEFAULT_API_URL = "https://api.arcusid.com";
export const DEFAULT_TIMEOUT_MS = 10_000;
const MIN_TIMEOUT_MS = 1_000;
const MAX_TIMEOUT_MS = 60_000;

export type Config = Readonly<{ apiUrl: string; timeoutMs: number }>;

// Reads ARCID_API_URL / ARCID_TIMEOUT_MS. Fails fast on bad values so a misconfigured
// client sees the problem at startup instead of on the first tool call.
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const raw = env.ARCID_API_URL?.trim() || DEFAULT_API_URL;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`ARCID_API_URL is not a valid URL: ${raw}`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error(`ARCID_API_URL must be http(s), got ${url.protocol}`);
  }

  const timeoutRaw = env.ARCID_TIMEOUT_MS?.trim();
  const timeoutMs = timeoutRaw ? Number(timeoutRaw) : DEFAULT_TIMEOUT_MS;
  if (!Number.isInteger(timeoutMs) || timeoutMs < MIN_TIMEOUT_MS || timeoutMs > MAX_TIMEOUT_MS) {
    throw new Error(`ARCID_TIMEOUT_MS must be an integer between ${MIN_TIMEOUT_MS} and ${MAX_TIMEOUT_MS}`);
  }

  return Object.freeze({ apiUrl: url.origin + url.pathname.replace(/\/+$/, ""), timeoutMs });
}
