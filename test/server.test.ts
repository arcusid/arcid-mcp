import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "../src/client.js";
import { createServer } from "../src/server.js";
import { toError } from "../src/tools.js";
import { config, mockFetch, okBody } from "./helpers.js";

let cleanup: (() => Promise<void>) | undefined;
afterEach(async () => { await cleanup?.(); cleanup = undefined; });

async function connect(fetchImpl: typeof fetch) {
  const server = createServer(createClient(config, fetchImpl));
  const client = new Client({ name: "test", version: "0.0.0" });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(a), client.connect(b)]);
  cleanup = async () => { await client.close(); await server.close(); };
  return client;
}

const text = (r: Awaited<ReturnType<Client["callTool"]>>) => (r.content as { text: string }[])[0]?.text ?? "";

describe("MCP server", () => {
  it("lists all tools as read-only", async () => {
    const client = await connect(mockFetch(okBody({})));
    const { tools } = await client.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual([
      "get_agent", "get_agent_feedback", "get_agent_validations", "get_indexer_health", "get_registry_stats", "search_agents",
    ]);
    for (const t of tools) expect(t.annotations?.readOnlyHint).toBe(true);
  });

  it("search_agents maps arguments to API params", async () => {
    const f = mockFetch(okBody([{ id: 3 }], { total: 1, page: 1, limit: 10 }));
    const client = await connect(f);
    const res = await client.callTool({ name: "search_agents", arguments: { query: "trade", readable_only: true, sort: "score", limit: 10 } });
    expect(String(f.mock.calls[0]?.[0])).toBe("https://api.test/v1/agents?q=trade&readable=true&sort=score&limit=10");
    expect(JSON.parse(text(res))).toEqual({ data: [{ id: 3 }], meta: { total: 1, page: 1, limit: 10 } });
  });

  it("get_agent and friends call the right endpoints", async () => {
    const f = mockFetch(okBody({ id: 5 }));
    const client = await connect(f);
    await client.callTool({ name: "get_agent", arguments: { agent_id: 5 } });
    await client.callTool({ name: "get_agent_feedback", arguments: { agent_id: 5, page: 2 } });
    await client.callTool({ name: "get_agent_validations", arguments: { agent_id: 5 } });
    await client.callTool({ name: "get_registry_stats", arguments: {} });
    await client.callTool({ name: "get_indexer_health", arguments: {} });
    expect(f.mock.calls.map((c) => String(c[0]))).toEqual([
      "https://api.test/v1/agents/5",
      "https://api.test/v1/agents/5/feedback?page=2",
      "https://api.test/v1/agents/5/validations",
      "https://api.test/v1/stats",
      "https://api.test/health",
    ]);
  });

  it("rejects invalid input before calling the API", async () => {
    const f = mockFetch(okBody({}));
    const client = await connect(f);
    const bad = await client.callTool({ name: "search_agents", arguments: { owner: "0x123" } });
    expect(bad.isError).toBe(true);
    const neg = await client.callTool({ name: "get_agent", arguments: { agent_id: -1 } });
    expect(neg.isError).toBe(true);
    expect(f).not.toHaveBeenCalled();
  });

  it("returns API errors as tool errors", async () => {
    const client = await connect(mockFetch({ success: false, data: null, error: "Agent #9 is not in the index" }, 404));
    const res = await client.callTool({ name: "get_agent", arguments: { agent_id: 9 } });
    expect(res.isError).toBe(true);
    expect(text(res)).toBe("Agent #9 is not in the index");
  });
});

describe("toError", () => {
  it("hides unexpected error details from the model", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = toError(new Error("secret internals"));
    expect(res).toEqual({ isError: true, content: [{ type: "text", text: "Unexpected error while calling the ArcID API" }] });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
