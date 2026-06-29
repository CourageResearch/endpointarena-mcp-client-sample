import assert from 'node:assert/strict'
import test from 'node:test'
import { keyConfiguredSummary, redactForJson, redactSecret } from '../src/redact.js'

test('redactSecret removes explicit secrets and Endpoint Arena API key patterns', () => {
  const text = 'Authorization Bearer ea_s4_super_secret_token and custom-token'
  const redacted = redactSecret(text, ['custom-token'])

  assert.equal(redacted.includes('ea_s4_super_secret_token'), false)
  assert.equal(redacted.includes('custom-token'), false)
  assert.match(redacted, /\[REDACTED_API_KEY\]/)
  assert.match(redacted, /\[REDACTED_SECRET\]/)
})

test('redactForJson redacts nested payloads', () => {
  const payload = {
    error: 'bad ea_s4_nested_secret',
    nested: {
      token: 'custom-secret',
    },
  }

  const redacted = redactForJson(payload, ['custom-secret'])
  assert.equal(JSON.stringify(redacted).includes('ea_s4_nested_secret'), false)
  assert.equal(JSON.stringify(redacted).includes('custom-secret'), false)
})

test('keyConfiguredSummary is non-sensitive', () => {
  const summary = keyConfiguredSummary('ea_s4_abc123xyz')

  assert.equal(summary.includes('abc123xyz'), false)
  assert.match(summary, /redacted/)
})
