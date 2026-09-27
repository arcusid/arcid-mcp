import { describe, expect, it, vi } from "vitest";
import worker, { apiFetch, type Env } from "./index.js";

const ok = (data: unknown) => new Response(JSON.stringify({ success: true, data, error: null }), { headers: { "content-type": "application/json" } });

function binding() {
  const calls: Request[] = [];
  const fetcher = { fetch: vi.fn(async (req: Request) => { calls.push(req); return ok({ behind: 0 }); }) };
  return { env: { API: fetcher as unknown as Fetcher } satisfies Env, calls };
}

const rpc = (body: unknown, ip = "203.0.113.7") =>
  new Request("https://mcp.arcusid.com/mcp", {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream", "cf-connecting-ip": ip },
    body: JSON.stringify(body),
  });

describe("worker", () => {
  it("redirects the root to the info page", async () => {
    const res = await worker.fetch(new Request("https://mcp.arcusid.com/"), {});
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://arcusid.com/mcp");
  });

  it("404s other paths", async () => {
    const res = await worker.fetch(new Request("https://mcp.arcusid.com/sse"), {});
    expect(res.status).toBe(404);
  });

  it("calls the API through the binding with the visitor's IP", async () => {
    const { env, calls } = binding();
    const res = await worker.fetch(
      rpc({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_indexer_health", arguments: {} } }),
      env,
    );
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://api.arcusid.com/health");
    expect(calls[0]!.headers.get("cf-connecting-ip")).toBe("203.0.113.7");
  });

  it("falls back to global fetch without a binding", () => {
    expect(apiFetch({}, "1.1.1.1")).toBe(fetch);
  });
});
