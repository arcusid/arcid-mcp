import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ArcIdClient } from "./client.js";
import { registerTools } from "./tools.js";

export const SERVER_NAME = "arcid";
export const SERVER_VERSION = "0.2.0";

export function createServer(client: ArcIdClient): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      instructions:
        "ArcID indexes AI agent identities and reputation from the ERC-8004 registries on Arc. " +
        "Use search_agents to find agents, then get_agent for the full record. If results are empty, " +
        "call get_indexer_health: the indexer may still be catching up with the chain.",
    },
  );
  registerTools(server, client);
  return server;
}
