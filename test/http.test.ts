import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../src/client.js";
import { handleMcpHttp, MAX_BODY_BYTES } from "../src/http.js";
import { config, mockFetch, okBody } from "./helpers.js";

const ENDPOINT = "https://mcp.test/mcp";
let close: (() => Promise<void>) | undefined;
afterEach(async () => { await close?.(); close = undefined; });

function handler(apiFetch = mockFetch(okBody({ indexedBlock: 1, headBlock: 1, behind: 0 }))) {
  const api = createClient(config, apiFetch);
  return (input: URL | RequestInfo, init?: RequestInit) => handleMcpHttp(new Request(input, init), api);
}

async function connect(h: ReturnType<typeof handler>) {
  const client = new Client({ name: "test", version: "0.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(ENDPOINT), { fetch: h }));
  close = () => client.close();
  return client;
}

const post = (body: string, headers: Record<string, string> = {}) =>
  new Request(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", ...headers },
    body,
  });

describe("handleMcpHttp", () => {
  it("serves a full MCP session over stateless HTTP", async () => {
    const client = await connect(handler());
    expect(client.getServerVersion()?.name).toBe("arcid");
    const { tools } = await client.listTools();
    expect(tools).toHaveLength(6);
    const res = await client.callTool({ name: "get_indexer_health", arguments: {} });
    expect(JSON.parse((res.content as { text: string }[])[0]!.text)).toEqual({ data: { indexedBlock: 1, headBlock: 1, behind: 0 } });
  });

  it("returns tool errors from the API", async () => {
    const client = await connect(handler(mockFetch({ success: false, data: null, error: "Agent #9 is not in the index" }, 404)));
    const res = await client.callTool({ name: "get_agent", arguments: { agent_id: 9 } });
    expect(res.isError).toBe(true);
  });

  it("answers CORS preflight", async () => {
    const res = await handler()(ENDPOINT, { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("access-control-allow-headers")).toContain("mcp-protocol-version");
  });

  it("rejects GET and DELETE with 405", async () => {
    for (const method of ["GET", "DELETE"]) {
      const res = await handler()(ENDPOINT, { method });
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST, OPTIONS");
    }
  });

  it("rejects oversized and malformed bodies", async () => {
    const h = handler();
    const big = await handleMcpHttp(post("x".repeat(MAX_BODY_BYTES + 1)), createClient(config, mockFetch(okBody({}))));
    expect(big.status).toBe(413);
    const bad = await h(ENDPOINT, { method: "POST", headers: { "content-type": "application/json", accept: "application/json, text/event-stream" }, body: "{nope" });
    expect(bad.status).toBe(400);
    expect(bad.headers.get("access-control-allow-origin")).toBe("*");
  });

  it("returns 500 without leaking details when the transport throws", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const fail = vi.spyOn(WebStandardStreamableHTTPServerTransport.prototype, "handleRequest").mockRejectedValue(new Error("boom"));
    const res = await handleMcpHttp(post("{}"), createClient(config, mockFetch(okBody({}))));
    fail.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain("boom");
    spy.mockRestore();
  });
});
