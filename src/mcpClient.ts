import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { AppConfig } from './config.js'
import { HttpError } from './errors.js'
import { redactForJson } from './redact.js'
import type { SubmitBody, TradeBody } from './safety.js'

type McpCallback<T> = (client: Client) => Promise<T>

export type AccountSummary = {
  readiness?: unknown
  balances?: Pick<Record<string, unknown>, 'cashUsd'>
  environment?: unknown
}

export type MarketsSummary = {
  markets: unknown[]
  count: number
}

function requireApiKey(config: AppConfig) {
  if (!config.apiKey) {
    throw new HttpError(401, 'MISSING_API_KEY', 'No Endpoint Arena API key is configured. Set ENDPOINT_ARENA_API_KEY on the server or paste a key in the sample UI.')
  }
}

export async function withMcpClient<T>(config: AppConfig, callback: McpCallback<T>): Promise<T> {
  requireApiKey(config)

  const abortController = new AbortController()
  const timeout = setTimeout(() => abortController.abort(), config.clientTimeoutMs)
  const transport = new StreamableHTTPClientTransport(new URL(config.mcpUrl), {
    requestInit: {
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
      },
      signal: abortController.signal,
    },
  })
  const client = new Client({
    name: 'endpointarena-independent-mcp-client-sample',
    version: '1.0.0',
  })

  try {
    await client.connect(transport)
    return await callback(client)
  } finally {
    clearTimeout(timeout)
    await client.close().catch(() => undefined)
  }
}

type ToolResultLike = {
  isError?: boolean
  content?: Array<{ type: string; text?: string }>
  structuredContent?: unknown
  toolResult?: unknown
}

export function parseToolResult(result: unknown): unknown {
  const payload = result && typeof result === 'object' ? result as ToolResultLike : {}
  if ('toolResult' in payload && payload.toolResult != null) {
    return parseToolResult(payload.toolResult)
  }

  if (payload.isError) {
    const text = payload.content
      ?.filter((item) => item.type === 'text')
      .map((item) => item.text)
      .join('\n')
    throw new HttpError(502, 'MCP_TOOL_ERROR', text || 'MCP tool returned an error')
  }

  if ('structuredContent' in payload && payload.structuredContent != null) {
    return payload.structuredContent
  }

  const text = payload.content
    ?.find((item) => item.type === 'text')
    ?.text
  if (!text) return result

  try {
    return JSON.parse(text)
  } catch {
    return { text }
  }
}

export async function callEndpointArenaTool(config: AppConfig, name: string, args: Record<string, unknown> = {}) {
  return withMcpClient(config, async (client) => {
    const result = await client.callTool({ name, arguments: args })
    return redactForJson(parseToolResult(result), [config.apiKey])
  })
}

export function summarizeAccount(payload: unknown): AccountSummary {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const balances = record.balances && typeof record.balances === 'object'
    ? record.balances as Record<string, unknown>
    : {}
  return {
    readiness: record.readiness,
    balances: {
      cashUsd: balances.cashUsd,
    },
    environment: record.environment,
  }
}

export function summarizeMarkets(payload: unknown): MarketsSummary {
  const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
  const markets = Array.isArray(record.markets) ? record.markets : []
  return {
    markets: markets.slice(0, 12),
    count: markets.length,
  }
}

export async function runSmoke(config: AppConfig) {
  return withMcpClient(config, async (client) => {
    const [tools, resources, prompts, accountResult, marketsResult] = await Promise.all([
      client.listTools(),
      client.listResources(),
      client.listPrompts(),
      client.callTool({ name: 'get_account', arguments: {} }),
      client.callTool({ name: 'list_markets', arguments: {} }),
    ])

    const account = parseToolResult(accountResult)
    const markets = parseToolResult(marketsResult)

    return redactForJson({
      ok: true,
      target: config.mcpUrl,
      server: client.getServerVersion(),
      tools: tools.tools.map((tool) => ({
        name: tool.name,
        title: tool.annotations?.title,
        destructive: tool.annotations?.destructiveHint === true,
      })),
      resources: resources.resources.map((resource) => ({
        uri: resource.uri,
        name: resource.name,
        title: resource.title,
      })),
      prompts: prompts.prompts.map((prompt) => ({
        name: prompt.name,
        title: prompt.title,
      })),
      account: summarizeAccount(account),
      markets: summarizeMarkets(markets),
    }, [config.apiKey])
  })
}

export async function quoteTrade(config: AppConfig, trade: TradeBody) {
  return callEndpointArenaTool(config, 'quote_trade', trade)
}

export async function submitTrade(config: AppConfig, submit: SubmitBody) {
  return withMcpClient(config, async (client) => {
    const account = parseToolResult(await client.callTool({ name: 'get_account', arguments: {} })) as Record<string, unknown>
    const readiness = account.readiness && typeof account.readiness === 'object'
      ? account.readiness as Record<string, unknown>
      : {}
    if (readiness.canTrade !== true) {
      throw new HttpError(409, 'ACCOUNT_NOT_READY', 'Endpoint Arena account readiness.canTrade is false', {
        readiness,
      })
    }

    const { confirm: _confirm, idempotencyKey, ...trade } = submit
    const quote = parseToolResult(await client.callTool({ name: 'quote_trade', arguments: trade }))
    const submitted = parseToolResult(await client.callTool({
      name: 'submit_trade',
      arguments: {
        ...trade,
        idempotencyKey,
      },
    }))

    return redactForJson({
      ok: true,
      quote,
      submitted,
    }, [config.apiKey])
  })
}
