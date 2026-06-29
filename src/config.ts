export type AppConfig = {
  mcpUrl: string
  apiKey: string
  allowSubmitTrades: boolean
  clientTimeoutMs: number
  port: number
}

const DEFAULT_MCP_URL = 'https://endpointarena.com/api/mcp'
const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_PORT = 3000

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null || value.trim() === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function normalizeUrl(value: string | undefined): string {
  const raw = (value?.trim() || DEFAULT_MCP_URL).replace(/\/+$/, '')
  const url = new URL(raw)
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('ENDPOINT_ARENA_MCP_URL must be an HTTP(S) URL')
  }
  return url.toString().replace(/\/+$/, '')
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return {
    mcpUrl: normalizeUrl(env.ENDPOINT_ARENA_MCP_URL),
    apiKey: env.ENDPOINT_ARENA_API_KEY?.trim() ?? '',
    allowSubmitTrades: parseBoolean(env.ALLOW_SUBMIT_TRADES, false),
    clientTimeoutMs: parsePositiveInteger(env.CLIENT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS),
    port: parsePositiveInteger(env.PORT, DEFAULT_PORT),
  }
}

export function publicConfig(config: AppConfig) {
  return {
    mcpUrl: config.mcpUrl,
    apiKeyConfigured: config.apiKey.length > 0,
    allowSubmitTrades: config.allowSubmitTrades,
    clientTimeoutMs: config.clientTimeoutMs,
  }
}
