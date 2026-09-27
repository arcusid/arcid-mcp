import { describe, expect, it, vi } from "vitest";
import { ArcIdApiError, createClient } from "../src/client.js";
import { config, mockFetch, okBody } from "./helpers.js";

const calledUrl = (f: ReturnType<typeof mockFetch>) => String(f.mock.calls[0]?.[0]);

describe("createClient", () => {
  it("builds list queries and drops undefined params", async () => {
    const f = mockFetch(okBody([{ id: 1 }], { total: 1, page: 1, limit: 5 }));
    const res = await createClient(config, f).listAgents({ q: "bounty", sort: "score", limit: 5, owner: undefined });
    expect(calledUrl(f)).toBe("https://api.test/v1/agents?q=bounty&sort=score&limit=5");
    expect(res).toEqual({ data: [{ id: 1 }], meta: { total: 1, page: 1, limit: 5 } });
  });

  it("hits every endpoint path", async () => {
    const f = mockFetch(okBody({}));
    const c = createClient(config, f);
    await c.health();
    await c.stats();
    await c.getAgent(7);
    await c.listFeedback(7, 2, 10);
    await c.listValidations(7);
    expect(f.mock.calls.map((call) => String(call[0]))).toEqual([
      "https://api.test/health",
      "https://api.test/v1/stats",
      "https://api.test/v1/agents/7",
      "https://api.test/v1/agents/7/feedback?page=2&limit=10",
      "https://api.test/v1/agents/7/validations",
    ]);
  });

  it("omits meta when absent", async () => {
    expect(await createClient(config, mockFetch(okBody({ a: 1 }))).stats()).toEqual({ data: { a: 1 } });
  });

  it("surfaces API error messages with status", async () => {
    const f = mockFetch({ success: false, data: null, error: "Agent #9 is not in the index" }, 404);
    const err = await createClient(config, f).getAgent(9).catch((e) => e);
    expect(err).toBeInstanceOf(ArcIdApiError);
    expect(err).toMatchObject({ message: "Agent #9 is not in the index", status: 404 });
  });

  it("falls back to a generic message when error is null", async () => {
    const f = mockFetch({ success: false, data: null, error: null }, 500);
    await expect(createClient(config, f).stats()).rejects.toThrow("ArcID API error (HTTP 500)");
  });

  it("rejects non-JSON and malformed payloads", async () => {
    const html = vi.fn(async () => new Response("<html>", { status: 502 }));
    await expect(createClient(config, html).stats()).rejects.toThrow(/non-JSON response \(HTTP 502\)/);
    await expect(createClient(config, mockFetch({ foo: 1 })).stats()).rejects.toThrow(/unexpected payload/);
  });

  it("reports network errors and timeouts without leaking details", async () => {
    const down = vi.fn(async () => { throw new TypeError("fetch failed: ECONNREFUSED 10.0.0.1"); });
    await expect(createClient(config, down).stats()).rejects.toThrow("ArcID API unreachable (network error)");

    const slow = vi.fn(async () => { throw Object.assign(new Error("t"), { name: "TimeoutError" }); });
    await expect(createClient(config, slow).stats()).rejects.toThrow("timed out after 1000 ms");
  });
});
