import { vi } from "vitest";

export const config = { apiUrl: "https://api.test", timeoutMs: 1_000 } as const;

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export function mockFetch(body: unknown, status = 200) {
  return vi.fn(async (_url: URL | RequestInfo, _init?: RequestInit) => jsonResponse(body, status));
}

export const okBody = (data: unknown, meta?: Record<string, unknown>) => ({ success: true, data, error: null, ...(meta ? { meta } : {}) });
