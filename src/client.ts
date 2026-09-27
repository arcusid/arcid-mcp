import { z } from "zod";
import type { Config } from "./config.js";

// Every ArcID endpoint answers with this envelope.
const envelope = z.object({
  success: z.boolean(),
  data: z.unknown(),
  error: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

export type ApiResult = Readonly<{ data: unknown; meta?: Record<string, unknown> }>;

export class ArcIdApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = "ArcIdApiError";
  }
}

export type AgentSort = "newest" | "score" | "feedback" | "settled" | "relevance";
export type ListAgentsParams = Readonly<{
  q?: string;
  owner?: string;
  readable?: boolean;
  sort?: AgentSort;
  page?: number;
  limit?: number;
}>;

type Query = Record<string, string | number | boolean | undefined>;

export type ArcIdClient = Readonly<{
  health: () => Promise<ApiResult>;
  stats: () => Promise<ApiResult>;
  listAgents: (p: ListAgentsParams) => Promise<ApiResult>;
  getAgent: (id: number) => Promise<ApiResult>;
  listFeedback: (id: number, page?: number, limit?: number) => Promise<ApiResult>;
  listValidations: (id: number) => Promise<ApiResult>;
}>;

export function createClient(config: Config, fetchImpl: typeof fetch = fetch): ArcIdClient {
  async function get(path: string, query: Query = {}): Promise<ApiResult> {
    const url = new URL(config.apiUrl + path);
    for (const [k, v] of Object.entries(query)) if (v !== undefined) url.searchParams.set(k, String(v));

    let res: Response;
    try {
      res = await fetchImpl(url, {
        headers: { accept: "application/json", "user-agent": "arcid-mcp" },
        signal: AbortSignal.timeout(config.timeoutMs),
      });
    } catch (err) {
      const reason = err instanceof Error && err.name === "TimeoutError" ? `timed out after ${config.timeoutMs} ms` : "network error";
      throw new ArcIdApiError(`ArcID API unreachable (${reason})`);
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      throw new ArcIdApiError(`ArcID API returned a non-JSON response (HTTP ${res.status})`, res.status);
    }
    const parsed = envelope.safeParse(body);
    if (!parsed.success) throw new ArcIdApiError(`ArcID API returned an unexpected payload (HTTP ${res.status})`, res.status);
    if (!res.ok || !parsed.data.success) {
      throw new ArcIdApiError(parsed.data.error ?? `ArcID API error (HTTP ${res.status})`, res.status);
    }
    return { data: parsed.data.data, ...(parsed.data.meta ? { meta: parsed.data.meta } : {}) };
  }

  return Object.freeze({
    health: () => get("/health"),
    stats: () => get("/v1/stats"),
    listAgents: (p) => get("/v1/agents", { ...p }),
    getAgent: (id) => get(`/v1/agents/${id}`),
    listFeedback: (id, page, limit) => get(`/v1/agents/${id}/feedback`, { page, limit }),
    listValidations: (id) => get(`/v1/agents/${id}/validations`),
  });
}
