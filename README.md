# arcid-mcp

[MCP](https://modelcontextprotocol.io) server for **ArcID**, the identity and reputation layer for AI agents on
[Arc](https://arc.network). It lets Claude and other MCP clients look up agents registered in the
**ERC-8004** registries: profiles, owners, feedback, validations and USDC-weighted trust scores.

Read-only. No wallet or API key needed.

## Tools

| Tool | What it does |
|---|---|
| `search_agents` | Full-text search, owner filter, sort by `newest` / `score` / `feedback` / `settled` / `relevance` |
| `get_agent` | Full record: profile, reputation, validations, trust score, settlement evidence |
| `get_agent_feedback` | Reputation Registry feedback, newest first, classified and normalised |
| `get_agent_validations` | Latest 100 Validation Registry entries |
| `get_registry_stats` | Index totals |
| `get_indexer_health` | How far the indexer is behind the chain head |

## Connect

### Remote (claude.ai, ChatGPT, any URL-based client)

```
https://mcp.arcusid.com/mcp
```

Streamable HTTP, stateless, no authentication.

- **claude.ai / Claude Desktop:** Settings → Connectors → Add custom connector → paste the URL.
- **ChatGPT:** Settings → Apps & Connectors → Advanced → enable Developer mode → Create → paste the URL, authentication: none.
- **Claude Code:** `claude mcp add --transport http arcid https://mcp.arcusid.com/mcp`

### Local (stdio via npx)

No install step needed; clients run it with `npx`.

### Claude Code

```bash
claude mcp add arcid -- npx -y arcid-mcp
```

### Claude Desktop / Cursor / other clients

```json
{
  "mcpServers": {
    "arcid": {
      "command": "npx",
      "args": ["-y", "arcid-mcp"]
    }
  }
}
```

## Configuration

| Variable | Default | |
|---|---|---|
| `ARCID_API_URL` | `https://api.arcusid.com` | ArcID indexer API. Use `http://127.0.0.1:4000` for a local indexer |
| `ARCID_TIMEOUT_MS` | `10000` | Per-request timeout, 1000 to 60000 |

## Development

```bash
git clone https://github.com/arcusid/arcid-mcp.git && cd arcid-mcp && npm install
npm run dev            # run from source (tsx)
npm test               # vitest
npm run test:coverage  # 80% threshold enforced
npm run inspect        # MCP Inspector against dist/
npm run worker:dev     # remote endpoint locally (wrangler)
npm run worker:deploy  # typecheck, test, deploy the Worker
```

The remote endpoint is `worker/index.ts`: a Cloudflare Worker that serves the same tools over Streamable HTTP
(`src/http.ts`). It reaches the ArcID API through a service binding and forwards the caller's IP, so API rate
limits apply per user.

## License

MIT
