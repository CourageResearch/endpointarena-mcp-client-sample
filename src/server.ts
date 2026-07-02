import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { URL } from 'node:url'
import { AutonomousTrader } from './autonomousTrader.js'
import {
  loadConfig,
  publicConfig,
  withApiKeyOverride,
  withAutonomousLimitOverrides,
} from './config.js'
import { publicErrorPayload } from './errors.js'
import { renderHome } from './html.js'
import {
  callEndpointArenaTool,
  quoteTrade,
  runSmoke,
  submitTrade,
  summarizeAccount,
  summarizeMarkets,
} from './mcpClient.js'
import { parseSubmitBody, parseTradeBody } from './safety.js'

const config = loadConfig()
const autonomousTrader = new AutonomousTrader(config)

function extractRequestApiKey(request: IncomingMessage): string | null {
  const explicit = request.headers['x-endpoint-arena-api-key']
  const explicitValue = Array.isArray(explicit) ? explicit[0] : explicit
  if (explicitValue?.trim()) return explicitValue.trim()

  const authorization = request.headers.authorization
  if (!authorization) return null
  const match = authorization.match(/^Bearer\s+(.+)$/i)
  return match?.[1]?.trim() || null
}

function sendJson(response: ServerResponse, status: number, payload: unknown) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload, null, 2))
}

function sendHtml(response: ServerResponse, html: string) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(html)
}

function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large'))
        request.destroy()
      }
    })
    request.on('end', () => {
      if (!body.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Request body must be JSON'))
      }
    })
    request.on('error', reject)
  })
}

async function route(request: IncomingMessage, response: ServerResponse) {
  const url = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`)
  const requestApiKey = extractRequestApiKey(request)
  const requestConfig = withApiKeyOverride(config, requestApiKey)

  if (request.method === 'GET' && url.pathname === '/') {
    sendHtml(response, renderHome(config))
    return
  }

  if (request.method === 'GET' && url.pathname === '/health') {
    sendJson(response, 200, {
      ok: true,
      service: 'endpointarena-mcp-client-sample',
      config: publicConfig(config),
      checkedAt: new Date().toISOString(),
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/smoke') {
    sendJson(response, 200, await runSmoke(requestConfig))
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/auto/status') {
    sendJson(response, 200, {
      ok: true,
      autonomous: autonomousTrader.status(),
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/auto/run') {
    const body = await readBody(request)
    const runConfig = withAutonomousLimitOverrides(requestConfig, body)
    const runner = requestApiKey || runConfig.hasOverrides
      ? new AutonomousTrader(runConfig.config)
      : autonomousTrader
    sendJson(response, 200, {
      ok: true,
      autonomous: await runner.runOnce('manual'),
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/account') {
    const account = await callEndpointArenaTool(requestConfig, 'get_account')
    sendJson(response, 200, {
      ok: true,
      account: summarizeAccount(account),
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/markets') {
    const markets = await callEndpointArenaTool(requestConfig, 'list_markets')
    sendJson(response, 200, {
      ok: true,
      ...summarizeMarkets(markets),
    })
    return
  }

  if (request.method === 'GET' && url.pathname === '/api/market') {
    const identifier = url.searchParams.get('identifier')?.trim()
    if (!identifier) {
      sendJson(response, 400, {
        ok: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'identifier query parameter is required',
        },
      })
      return
    }
    sendJson(response, 200, {
      ok: true,
      market: await callEndpointArenaTool(requestConfig, 'get_market', { identifier }),
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/quote') {
    const body = await readBody(request)
    const trade = parseTradeBody(body)
    sendJson(response, 200, {
      ok: true,
      quote: await quoteTrade(requestConfig, trade),
    })
    return
  }

  if (request.method === 'POST' && url.pathname === '/api/submit') {
    const body = await readBody(request)
    const submit = parseSubmitBody(requestConfig, body)
    sendJson(response, 200, await submitTrade(requestConfig, submit))
    return
  }

  sendJson(response, 404, {
    ok: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found',
    },
  })
}

const server = createServer((request, response) => {
  route(request, response).catch((error) => {
    const payload = publicErrorPayload(error, [config.apiKey, extractRequestApiKey(request)])
    sendJson(response, payload.status, payload.body)
  })
})

server.listen(config.port, () => {
  console.log(JSON.stringify({
    service: 'endpointarena-mcp-client-sample',
    status: 'listening',
    port: config.port,
    mcpUrl: config.mcpUrl,
    apiKeyConfigured: config.apiKey.length > 0,
    allowSubmitTrades: config.allowSubmitTrades,
    autonomousTradingEnabled: config.autonomousTradingEnabled,
    autonomousDryRun: config.autonomousDryRun,
  }))
  autonomousTrader.start()
})
