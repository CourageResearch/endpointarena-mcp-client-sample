import { HttpError } from './errors.js'

export type AppConfig = {
  mcpUrl: string
  apiKey: string
  allowSubmitTrades: boolean
  clientTimeoutMs: number
  port: number
  autonomousTradingEnabled: boolean
  autonomousDryRun: boolean
  autonomousIntervalMs: number
  autonomousMaxTradeUsd: number
  autonomousDailySpendLimitUsd: number
  autonomousMinEdgeBps: number
  autonomousSlippageBps: number
  autonomousMarketAllowlist: string[]
}

const DEFAULT_MCP_URL = 'https://endpointarena.com/api/mcp'
const DEFAULT_TIMEOUT_MS = 120_000
const DEFAULT_PORT = 3000
const DEFAULT_AUTONOMOUS_INTERVAL_MS = 15 * 60_000

function parseBoolean(value: string | undefined, fallback = false): boolean {
  if (value == null || value.trim() === '') return fallback
  return ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parsePositiveNumber(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseOptionalPositiveOverride(record: Record<string, unknown>, key: string): number | undefined {
  if (!(key in record) || record[key] === undefined || record[key] === '') return undefined
  const parsed = typeof record[key] === 'number' ? record[key] : Number(record[key])
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${key} must be a positive number`)
  }
  return parsed
}

function parseNonNegativeInteger(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback
  const parsed = Number.parseInt(value, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

function parseCsv(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
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
    autonomousTradingEnabled: parseBoolean(env.AUTONOMOUS_TRADING_ENABLED, false),
    autonomousDryRun: parseBoolean(env.AUTONOMOUS_DRY_RUN, true),
    autonomousIntervalMs: parsePositiveInteger(env.AUTONOMOUS_INTERVAL_MS, DEFAULT_AUTONOMOUS_INTERVAL_MS),
    autonomousMaxTradeUsd: parsePositiveNumber(env.AUTONOMOUS_MAX_TRADE_USD, 1),
    autonomousDailySpendLimitUsd: parsePositiveNumber(env.AUTONOMOUS_DAILY_SPEND_LIMIT_USD, 3),
    autonomousMinEdgeBps: parseNonNegativeInteger(env.AUTONOMOUS_MIN_EDGE_BPS, 500),
    autonomousSlippageBps: parseNonNegativeInteger(env.AUTONOMOUS_SLIPPAGE_BPS, 100),
    autonomousMarketAllowlist: parseCsv(env.AUTONOMOUS_MARKET_ALLOWLIST),
  }
}

export function publicConfig(config: AppConfig) {
  return {
    mcpUrl: config.mcpUrl,
    apiKeyConfigured: config.apiKey.length > 0,
    allowSubmitTrades: config.allowSubmitTrades,
    clientTimeoutMs: config.clientTimeoutMs,
    autonomousTradingEnabled: config.autonomousTradingEnabled,
    autonomousDryRun: config.autonomousDryRun,
    autonomousIntervalMs: config.autonomousIntervalMs,
    autonomousMaxTradeUsd: config.autonomousMaxTradeUsd,
    autonomousDailySpendLimitUsd: config.autonomousDailySpendLimitUsd,
    autonomousMinEdgeBps: config.autonomousMinEdgeBps,
    autonomousSlippageBps: config.autonomousSlippageBps,
    autonomousMarketAllowlist: config.autonomousMarketAllowlist,
  }
}

export function withApiKeyOverride(config: AppConfig, apiKey: string | null): AppConfig {
  const trimmed = apiKey?.trim()
  if (!trimmed) return config
  return {
    ...config,
    apiKey: trimmed,
  }
}

export function withAutonomousLimitOverrides(
  config: AppConfig,
  overrides: unknown,
): { config: AppConfig, hasOverrides: boolean } {
  if (overrides == null) return { config, hasOverrides: false }
  if (typeof overrides !== 'object' || Array.isArray(overrides)) {
    throw new HttpError(400, 'BAD_REQUEST', 'Autonomous limit overrides must be a JSON object')
  }

  const record = overrides as Record<string, unknown>
  const autonomousMaxTradeUsd = parseOptionalPositiveOverride(record, 'autonomousMaxTradeUsd')
  const autonomousDailySpendLimitUsd = parseOptionalPositiveOverride(record, 'autonomousDailySpendLimitUsd')
  const hasOverrides = autonomousMaxTradeUsd !== undefined || autonomousDailySpendLimitUsd !== undefined

  if (!hasOverrides) return { config, hasOverrides: false }
  return {
    config: {
      ...config,
      ...(autonomousMaxTradeUsd === undefined ? {} : { autonomousMaxTradeUsd }),
      ...(autonomousDailySpendLimitUsd === undefined ? {} : { autonomousDailySpendLimitUsd }),
    },
    hasOverrides: true,
  }
}
