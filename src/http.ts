import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { ArcIdClient } from "./client.js";
import { createServer } from "./server.js";

// Remote (Streamable HTTP) transport for runtimes with web-standard Request/Response, e.g. Cloudflare Workers.
// Stateless: every POST gets a fresh server and transport, so no session state lives between requests.

export const MCP_PATH = "/mcp";
export const MAX_BODY_BYTES = 64 * 1024;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "POST, OPTIONS",
  "access-control-allow-headers": "content-type, accept, authorization, mcp-protocol-version, mcp-session-id, last-event-id",
  "access-control-expose-headers": "mcp-session-id, mcp-protocol-version",
  "access-control-max-age": "600",
} as const;

function withCors(res: Response): Response {
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(CORS_HEADERS)) headers.set(k, v);
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
}

function rpcError(status: number, message: string, extra: Record<string, string> = {}): Response {
  const body = JSON.stringify({ jsonrpc: "2.0", error: { code: -32000, message }, id: null });
  return withCors(new Response(body, { status, headers: { "content-type": "application/json", ...extra } }));
}

export async function handleMcpHttp(request: Request, client: ArcIdClient): Promise<Response> {
  if (request.method === "OPTIONS") return withCors(new Response(null, { status: 204 }));
  if (request.method !== "POST") {
    return rpcError(405, "Method not allowed. This endpoint is stateless: send JSON-RPC over POST.", { allow: "POST, OPTIONS" });
  }

  const server = createServer(client);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_BODY_BYTES,
  });
  try {
    await server.connect(transport);
    return withCors(await transport.handleRequest(request));
  } catch (err) {
    console.error("[arcid-mcp] http transport error", err);
    return rpcError(500, "Internal error");
  } finally {
    // Response bodies are fully materialised in JSON mode, so closing here is safe.
    await transport.close().catch(() => {});
    await server.close().catch(() => {});
  }
}
