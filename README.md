# Endpoint Arena MCP Client Sample

This is an independent sample app for testing the public Endpoint Arena MCP server as an outside client.

It does not import code from the Endpoint Arena application, connect to the Endpoint Arena database, or require access to the Endpoint Arena Railway project. The only integration is the public MCP endpoint plus an Endpoint Arena API key.

## What It Does

- Connects to `https://endpointarena.com/api/mcp` over Streamable HTTP.
- Uses `@modelcontextprotocol/sdk` `Client` and `StreamableHTTPClientTransport`.
- Lists tools, resources, and prompts.
- Calls `get_account`, `list_markets`, `get_market`, and `quote_trade`.
- Keeps `submit_trade` disabled by default and requires explicit confirmation when enabled.

## Environment

Copy `.env.example` to `.env` for local development:

```sh
ENDPOINT_ARENA_MCP_URL=https://endpointarena.com/api/mcp
ENDPOINT_ARENA_API_KEY=ea_s4_replace_me
ALLOW_SUBMIT_TRADES=false
CLIENT_TIMEOUT_MS=120000
PORT=3000
```

Never commit a real `ENDPOINT_ARENA_API_KEY`.

## Local Development

```sh
npm install
npm run typecheck
npm test
npm run dev
```

Open `http://127.0.0.1:3000`.

Useful smoke checks:

```sh
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/api/smoke
```

Without `ENDPOINT_ARENA_API_KEY`, `/health` still succeeds and `/api/smoke` returns a clear missing-key error.

## Railway

Create a new Railway project/service from this repo and set:

```sh
ENDPOINT_ARENA_MCP_URL=https://endpointarena.com/api/mcp
ENDPOINT_ARENA_API_KEY=<your Endpoint Arena API key>
ALLOW_SUBMIT_TRADES=false
CLIENT_TIMEOUT_MS=120000
```

The Railway healthcheck is `/health`.

## Safety

`POST /api/submit` is intentionally fail-closed:

- `ALLOW_SUBMIT_TRADES` must be `true`.
- The request must include `confirm: true`.
- The request must include an `idempotencyKey`.
- The app calls `get_account` and refuses to submit if `readiness.canTrade` is not true.
- The app quotes before calling `submit_trade`.

Keep `ALLOW_SUBMIT_TRADES=false` for shared demos.
