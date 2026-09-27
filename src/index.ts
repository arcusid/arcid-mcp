#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createClient } from "./client.js";
import { loadConfig } from "./config.js";
import { createServer } from "./server.js";

async function main() {
  const config = loadConfig();
  const server = createServer(createClient(config));
  await server.connect(new StdioServerTransport());
  // stdout carries the MCP protocol, so logs go to stderr.
  console.error(`[arcid-mcp] ready, API ${config.apiUrl}`);
}

main().catch((err) => {
  console.error("[arcid-mcp] failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});
