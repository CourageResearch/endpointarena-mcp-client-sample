import assert from 'node:assert/strict'
import test from 'node:test'
import {
  loadConfig,
  publicConfig,
  withApiKeyOverride,
  withAutonomousLimitOverrides,
} from '../src/config.js'

test('loadConfig defaults to production MCP and safe submit settings', () => {
  const config = loadConfig({})

  assert.equal(config.mcpUrl, 'https://endpointarena.com/api/mcp')
  assert.equal(config.apiKey, '')
  assert.equal(config.allowSubmitTrades, false)
  assert.equal(config.clientTimeoutMs, 120_000)
  assert.equal(config.port, 3000)
  assert.equal(config.autonomousTradingEnabled, false)
  assert.equal(config.autonomousDryRun, true)
  assert.equal(config.autonomousIntervalMs, 900_000)
  assert.equal(config.autonomousMaxTradeUsd, 1)
  assert.equal(config.autonomousDailySpendLimitUsd, 3)
  assert.equal(config.autonomousMinEdgeBps, 500)
  assert.equal(config.autonomousSlippageBps, 100)
  assert.deepEqual(config.autonomousMarketAllowlist, [])
})

test('publicConfig never returns raw API key', () => {
  const config = loadConfig({
    ENDPOINT_ARENA_API_KEY: 'ea_s4_secret_value',
    ALLOW_SUBMIT_TRADES: 'true',
  })

  assert.deepEqual(publicConfig(config), {
    mcpUrl: 'https://endpointarena.com/api/mcp',
    apiKeyConfigured: true,
    allowSubmitTrades: true,
    clientTimeoutMs: 120_000,
    autonomousTradingEnabled: false,
    autonomousDryRun: true,
    autonomousIntervalMs: 900_000,
    autonomousMaxTradeUsd: 1,
    autonomousDailySpendLimitUsd: 3,
    autonomousMinEdgeBps: 500,
    autonomousSlippageBps: 100,
    autonomousMarketAllowlist: [],
  })
  assert.equal(JSON.stringify(publicConfig(config)).includes('ea_s4_secret_value'), false)
})

test('loadConfig parses autonomous trading controls', () => {
  const config = loadConfig({
    AUTONOMOUS_TRADING_ENABLED: 'true',
    AUTONOMOUS_DRY_RUN: 'false',
    AUTONOMOUS_INTERVAL_MS: '60000',
    AUTONOMOUS_MAX_TRADE_USD: '0.25',
    AUTONOMOUS_DAILY_SPEND_LIMIT_USD: '1.5',
    AUTONOMOUS_MIN_EDGE_BPS: '250',
    AUTONOMOUS_SLIPPAGE_BPS: '50',
    AUTONOMOUS_MARKET_ALLOWLIST: 'nct1, nct2',
  })

  assert.equal(config.autonomousTradingEnabled, true)
  assert.equal(config.autonomousDryRun, false)
  assert.equal(config.autonomousIntervalMs, 60_000)
  assert.equal(config.autonomousMaxTradeUsd, 0.25)
  assert.equal(config.autonomousDailySpendLimitUsd, 1.5)
  assert.equal(config.autonomousMinEdgeBps, 250)
  assert.equal(config.autonomousSlippageBps, 50)
  assert.deepEqual(config.autonomousMarketAllowlist, ['nct1', 'nct2'])
})

test('withApiKeyOverride swaps API keys without mutating the base config', () => {
  const base = loadConfig({ ENDPOINT_ARENA_API_KEY: 'ea_s4_server_key' })
  const overridden = withApiKeyOverride(base, ' ea_s4_browser_key ')

  assert.equal(base.apiKey, 'ea_s4_server_key')
  assert.equal(overridden.apiKey, 'ea_s4_browser_key')
  assert.equal(withApiKeyOverride(base, '').apiKey, 'ea_s4_server_key')
})

test('withAutonomousLimitOverrides applies per-run autonomous limits', () => {
  const base = loadConfig({
    AUTONOMOUS_MAX_TRADE_USD: '1',
    AUTONOMOUS_DAILY_SPEND_LIMIT_USD: '3',
  })
  const result = withAutonomousLimitOverrides(base, {
    autonomousMaxTradeUsd: '2.5',
    autonomousDailySpendLimitUsd: 9,
  })

  assert.equal(result.hasOverrides, true)
  assert.equal(result.config.autonomousMaxTradeUsd, 2.5)
  assert.equal(result.config.autonomousDailySpendLimitUsd, 9)
  assert.equal(base.autonomousMaxTradeUsd, 1)
  assert.equal(base.autonomousDailySpendLimitUsd, 3)
})

test('withAutonomousLimitOverrides rejects invalid autonomous limits', () => {
  const base = loadConfig({})

  assert.throws(
    () => withAutonomousLimitOverrides(base, { autonomousMaxTradeUsd: 0 }),
    /autonomousMaxTradeUsd must be a positive number/,
  )
  assert.throws(
    () => withAutonomousLimitOverrides(base, []),
    /Autonomous limit overrides must be a JSON object/,
  )
})
