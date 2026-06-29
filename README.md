# Endpoint Arena MCP Client Sample

This is an independent sample app for testing the public Endpoint Arena MCP server as an outside client.

It does not import code from the Endpoint Arena application, connect to the Endpoint Arena database, or require access to the Endpoint Arena Railway project. The only integration is the public MCP endpoint plus an Endpoint Arena API key.

## What It Does

- Connects to `https://endpointarena.com/api/mcp` over Streamable HTTP.
- Uses `@modelcontextprotocol/sdk` `Client` and `StreamableHTTPClientTransport`.
- Lists tools, resources, and prompts.
- Calls `get_account`, `list_markets`, `get_market`, and `quote_trade`.
- Keeps `submit_trade` disabled by default and requires explicit confirmation when enabled.
- Includes a tiny open-source autonomous model, `simple-open-source-edge-v1`, that can rank markets, quote its selected BUY_YES/BUY_NO trade, and optionally submit when all safety gates are enabled.

## Environment

Copy `.env.example` to `.env` for local development:

```sh
ENDPOINT_ARENA_MCP_URL=https://endpointarena.com/api/mcp
ENDPOINT_ARENA_API_KEY=ea_s4_replace_me
ALLOW_SUBMIT_TRADES=false
CLIENT_TIMEOUT_MS=120000
PORT=3000
AUTONOMOUS_TRADING_ENABLED=false
AUTONOMOUS_DRY_RUN=true
AUTONOMOUS_INTERVAL_MS=900000
AUTONOMOUS_MAX_TRADE_USD=1
AUTONOMOUS_DAILY_SPEND_LIMIT_USD=3
AUTONOMOUS_MIN_EDGE_BPS=500
AUTONOMOUS_SLIPPAGE_BPS=100
AUTONOMOUS_MARKET_ALLOWLIST=
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
curl -X POST http://127.0.0.1:3000/api/auto/run
```

Without `ENDPOINT_ARENA_API_KEY`, `/health` still succeeds and `/api/smoke` returns a clear missing-key error.

## Railway

Create a new Railway project/service from this repo and set:

```sh
ENDPOINT_ARENA_MCP_URL=https://endpointarena.com/api/mcp
ENDPOINT_ARENA_API_KEY=<your Endpoint Arena API key>
ALLOW_SUBMIT_TRADES=false
CLIENT_TIMEOUT_MS=120000
AUTONOMOUS_TRADING_ENABLED=true
AUTONOMOUS_DRY_RUN=true
```

The Railway healthcheck is `/health`.

## Autonomous Mode

The autonomous runner is intentionally simple and transparent. The model is implemented in this repo under an MIT license and uses market price, trial phase, current trial status, endpoint-confidence metadata, and activity to create a toy probability estimate. It is not investment advice.

Autonomous mode:

- Calls `get_account` and stops before quote/submit when `readiness.canTrade` is false.
- Calls `list_markets`.
- Ranks open deployed markets with `simple-open-source-edge-v1`.
- Selects the highest positive-edge BUY_YES or BUY_NO candidate.
- Calls `quote_trade` before any possible submit.
- In dry-run mode, records the quote and stops.
- In live mode, submits only when `AUTONOMOUS_DRY_RUN=false`, `ALLOW_SUBMIT_TRADES=true`, daily caps have room, and Endpoint Arena readiness passes.

Recommended shared-demo settings:

```sh
AUTONOMOUS_TRADING_ENABLED=true
AUTONOMOUS_DRY_RUN=true
ALLOW_SUBMIT_TRADES=false
AUTONOMOUS_MAX_TRADE_USD=1
AUTONOMOUS_DAILY_SPEND_LIMIT_USD=3
```

Live autonomous submissions require deliberately changing both `AUTONOMOUS_DRY_RUN=false` and `ALLOW_SUBMIT_TRADES=true`.

## Safety

`POST /api/submit` is intentionally fail-closed:

- `ALLOW_SUBMIT_TRADES` must be `true`.
- The request must include `confirm: true`.
- The request must include an `idempotencyKey`.
- The app calls `get_account` and refuses to submit if `readiness.canTrade` is not true.
- The app quotes before calling `submit_trade`.

Keep `ALLOW_SUBMIT_TRADES=false` for shared demos.
