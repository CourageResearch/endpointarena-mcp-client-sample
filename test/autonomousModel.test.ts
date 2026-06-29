import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfig } from '../src/config.js'
import {
  OPEN_SOURCE_MODEL_LICENSE,
  OPEN_SOURCE_MODEL_NAME,
  modelProbabilityYes,
  rankAutonomousDecisions,
} from '../src/autonomousModel.js'

const market = {
  marketId: 'nct-test',
  title: 'Example Trial',
  status: 'deployed',
  resolvedOutcome: null,
  prices: {
    yes: 0.42,
    no: 0.58,
  },
  activity: {
    volumeUsd: 50,
    tradeCount: 3,
  },
  trial: {
    phase: 'Phase 3',
    currentStatus: 'Active Not Recruiting',
    marketEndpointConfidence: 95,
  },
}

test('open source model metadata is explicit', () => {
  assert.equal(OPEN_SOURCE_MODEL_NAME, 'simple-open-source-edge-v1')
  assert.equal(OPEN_SOURCE_MODEL_LICENSE, 'MIT')
})

test('modelProbabilityYes returns a bounded probability', () => {
  const probability = modelProbabilityYes(market)

  assert(probability > 0)
  assert(probability < 1)
})

test('rankAutonomousDecisions chooses a positive-edge candidate', () => {
  const config = loadConfig({
    AUTONOMOUS_MAX_TRADE_USD: '0.5',
    AUTONOMOUS_MIN_EDGE_BPS: '100',
  })
  const decisions = rankAutonomousDecisions({ markets: [market] }, config)

  assert.equal(decisions.length, 1)
  assert.equal(decisions[0].marketId, 'nct-test')
  assert.equal(decisions[0].action, 'BUY_YES')
  assert.equal(decisions[0].amountUsd, 0.5)
  assert(decisions[0].edgeBps >= 100)
})

test('rankAutonomousDecisions respects allowlists and skips resolved markets', () => {
  const allowlisted = rankAutonomousDecisions({
    markets: [market, { ...market, marketId: 'other' }],
  }, loadConfig({ AUTONOMOUS_MARKET_ALLOWLIST: 'nct-test', AUTONOMOUS_MIN_EDGE_BPS: '100' }))
  assert.deepEqual(allowlisted.map((decision) => decision.marketId), ['nct-test'])

  const resolved = rankAutonomousDecisions({
    markets: [{ ...market, resolvedOutcome: 'YES' }],
  }, loadConfig({ AUTONOMOUS_MIN_EDGE_BPS: '100' }))
  assert.equal(resolved.length, 0)
})
