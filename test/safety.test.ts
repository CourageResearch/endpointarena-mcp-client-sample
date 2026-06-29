import assert from 'node:assert/strict'
import test from 'node:test'
import { loadConfig } from '../src/config.js'
import { HttpError } from '../src/errors.js'
import { parseSubmitBody, parseTradeBody } from '../src/safety.js'

test('parseTradeBody normalizes and validates quote requests', () => {
  assert.deepEqual(parseTradeBody({
    marketId: ' market-1 ',
    action: 'buy_yes',
    amountUsd: '1.25',
    slippageBps: '100',
  }), {
    marketId: 'market-1',
    action: 'BUY_YES',
    amountUsd: 1.25,
    slippageBps: 100,
  })

  assert.throws(() => parseTradeBody({
    marketId: 'market-1',
    action: 'BUY_MAYBE',
    amountUsd: 1,
  }), /action/)
})

test('parseSubmitBody fails closed unless enabled and confirmed', () => {
  const disabled = loadConfig({})
  assert.throws(() => parseSubmitBody(disabled, {
    marketId: 'market-1',
    action: 'BUY_YES',
    amountUsd: 1,
    idempotencyKey: 'sample-1',
    confirm: true,
  }), (error) => error instanceof HttpError && error.code === 'SUBMIT_DISABLED')

  const enabled = loadConfig({ ALLOW_SUBMIT_TRADES: 'true' })
  assert.throws(() => parseSubmitBody(enabled, {
    marketId: 'market-1',
    action: 'BUY_YES',
    amountUsd: 1,
    idempotencyKey: 'sample-1',
  }), (error) => error instanceof HttpError && error.code === 'CONFIRMATION_REQUIRED')

  assert.equal(parseSubmitBody(enabled, {
    marketId: 'market-1',
    action: 'BUY_YES',
    amountUsd: 1,
    idempotencyKey: 'sample-1',
    confirm: true,
  }).idempotencyKey, 'sample-1')
})
