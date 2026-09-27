import { createClient } from "../src/client.js";
import { DEFAULT_API_URL, DEFAULT_TIMEOUT_MS } from "../src/config.js";
import { handleMcpHttp, MCP_PATH } from "../src/http.js";

// mcp.arcusid.com: the ArcID MCP server over Streamable HTTP, for web clients (claude.ai, ChatGPT) and
// anything else that connects to a URL instead of launching a local process.

export interface Env {
  // Service binding to the arcid-api Worker. Optional so the Worker also runs against a public URL.
  API?: Fetcher;
  ARCID_API_URL?: string;
  INFO_URL?: string;
}

// The API rate-limits on the caller's IP. Through a service binding the request would otherwise look
// like it came from this Worker, so every MCP user would share one bucket.
export function apiFetch(env: Env, clientIp: string): typeof fetch {
  const api = env.API;
  if (!api) return fetch;
  return (input, init) => {
    const req = new Request(input, init);
    const headers = new Headers(req.headers);
    headers.set("cf-connecting-ip", clientIp);
    return api.fetch(new Request(req, { headers }));
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/" && request.method === "GET") {
      return Response.redirect(env.INFO_URL ?? "https://arcusid.com/mcp", 302);
    }
    if (url.pathname !== MCP_PATH) {
      return new Response(JSON.stringify({ error: `Not found. The MCP endpoint is ${MCP_PATH}` }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    }

    const clientIp = request.headers.get("cf-connecting-ip") ?? "unknown";
    const client = createClient(
      { apiUrl: env.ARCID_API_URL ?? DEFAULT_API_URL, timeoutMs: DEFAULT_TIMEOUT_MS },
      apiFetch(env, clientIp),
    );
    return handleMcpHttp(request, client);
  },
} satisfies ExportedHandler<Env>;
