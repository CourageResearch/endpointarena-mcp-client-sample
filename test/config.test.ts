import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfig, publicConfig } from '../src/config.js'

test('loadConfig defaults to production MCP and safe submit settings', () => {
  const config = loadConfig({})

  assert.equal(config.mcpUrl, 'https://endpointarena.com/api/mcp')
  assert.equal(config.apiKey, '')
  assert.equal(config.allowSubmitTrades, false)
  assert.equal(config.clientTimeoutMs, 120_000)
  assert.equal(config.port, 3000)
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
  })
  assert.equal(JSON.stringify(publicConfig(config)).includes('ea_s4_secret_value'), false)
})
