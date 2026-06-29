import assert from 'node:assert/strict'
import test from 'node:test'
import { HttpError } from '../src/errors.js'
import { parseToolResult, summarizeAccount, summarizeMarkets } from '../src/mcpClient.js'

test('parseToolResult prefers structured content', () => {
  const result = parseToolResult({
    content: [{ type: 'text', text: '{"fallback":true}' }],
    structuredContent: { ok: true },
  })

  assert.deepEqual(result, { ok: true })
})

test('parseToolResult parses text content and reports tool errors', () => {
  assert.deepEqual(parseToolResult({
    content: [{ type: 'text', text: '{"markets":[]}' }],
  }), { markets: [] })

  assert.throws(() => parseToolResult({
    isError: true,
    content: [{ type: 'text', text: 'Tool failed' }],
  }), (error) => error instanceof HttpError && error.code === 'MCP_TOOL_ERROR')
})

test('summaries keep responses compact', () => {
  assert.deepEqual(summarizeAccount({
    balances: { cashUsd: 3, wallet: '0xabc' },
    readiness: { canTrade: false },
    environment: { season: 'Season 6' },
    account: { private: true },
  }), {
    balances: { cashUsd: 3 },
    readiness: { canTrade: false },
    environment: { season: 'Season 6' },
  })

  const markets = summarizeMarkets({ markets: Array.from({ length: 20 }, (_, index) => ({ index })) })
  assert.equal(markets.count, 20)
  assert.equal(markets.markets.length, 12)
})
