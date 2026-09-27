import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { ArcIdApiError, type ApiResult, type ArcIdClient } from "./client.js";

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true } as const;

const agentId = z.number().int().min(0).max(999_999_999_999_999).describe("ERC-8004 agent ID (token ID in the Identity Registry)");
const page = z.number().int().min(1).max(10_000).optional().describe("Page number, starting at 1");
const limit = z.number().int().min(1).max(100).optional();

export function toResult(result: ApiResult): CallToolResult {
  const payload = result.meta ? { data: result.data, meta: result.meta } : { data: result.data };
  return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
}

export function toError(err: unknown): CallToolResult {
  const message = err instanceof ArcIdApiError ? err.message : "Unexpected error while calling the ArcID API";
  if (!(err instanceof ArcIdApiError)) console.error("[arcid-mcp]", err);
  return { isError: true, content: [{ type: "text", text: message }] };
}

async function run(call: () => Promise<ApiResult>): Promise<CallToolResult> {
  try {
    return toResult(await call());
  } catch (err) {
    return toError(err);
  }
}

export function registerTools(server: McpServer, client: ArcIdClient): void {
  server.registerTool(
    "search_agents",
    {
      title: "Search agents",
      description:
        "Search the ArcID directory of AI agents registered on Arc (ERC-8004). Supports full-text search over names and " +
        "descriptions, filtering by owner address, and sorting by trust score, feedback count or settled USDC.",
      inputSchema: {
        query: z.string().trim().max(120).optional().describe("Full-text search (prefix match on words)"),
        owner: z.string().regex(/^0x[0-9a-fA-F]{40}$/, "owner must be a 0x address").optional().describe("Owner wallet address"),
        readable_only: z.boolean().default(true)
          .describe("Only agents with a readable profile (name, description). Default true; set false to include unnamed agents"),
        sort: z.enum(["newest", "score", "feedback", "settled", "relevance"]).optional()
          .describe("Default: relevance when a query is given, otherwise newest"),
        page,
        limit: limit.describe("Results per page, 1-100 (default 24)"),
      },
      annotations: { title: "Search agents", ...READ_ONLY },
    },
    ({ query, owner, readable_only, sort, page, limit }) =>
      run(() => client.listAgents({ q: query, owner, readable: readable_only, sort, page, limit })),
  );

  server.registerTool(
    "get_agent",
    {
      title: "Get agent",
      description:
        "Full ArcID record for one agent: profile, owner, agent wallet, reputation summary, validations, trust score " +
        "and the USDC settlement evidence behind it.",
      inputSchema: { agent_id: agentId },
      annotations: { title: "Get agent", ...READ_ONLY },
    },
    ({ agent_id }) => run(() => client.getAgent(agent_id)),
  );

  server.registerTool(
    "get_agent_feedback",
    {
      title: "Get agent feedback",
      description:
        "Feedback left for an agent in the ERC-8004 Reputation Registry, newest first. Each entry is classified " +
        "(receipt, rating, metric, self, revoked) with a normalised 0-100 rating where applicable.",
      inputSchema: { agent_id: agentId, page, limit: limit.describe("Results per page, 1-100 (default 50)") },
      annotations: { title: "Get agent feedback", ...READ_ONLY },
    },
    ({ agent_id, page, limit }) => run(() => client.listFeedback(agent_id, page, limit)),
  );

  server.registerTool(
    "get_agent_validations",
    {
      title: "Get agent validations",
      description: "The latest 100 validation requests and responses for an agent from the ERC-8004 Validation Registry.",
      inputSchema: { agent_id: agentId },
      annotations: { title: "Get agent validations", ...READ_ONLY },
    },
    ({ agent_id }) => run(() => client.listValidations(agent_id)),
  );

  server.registerTool(
    "get_registry_stats",
    {
      title: "Get registry stats",
      description: "Totals across the ArcID index: agents, owners, feedback, validations and settled USDC.",
      annotations: { title: "Get registry stats", ...READ_ONLY },
    },
    () => run(() => client.stats()),
  );

  server.registerTool(
    "get_indexer_health",
    {
      title: "Get indexer health",
      description:
        "How far the ArcID indexer is behind the Arc chain head. Check this when results look empty or stale.",
      annotations: { title: "Get indexer health", ...READ_ONLY },
    },
    () => run(() => client.health()),
  );
}
