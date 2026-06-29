import type { AppConfig } from './config.js'
import { HttpError } from './errors.js'

const TRADE_ACTIONS = new Set(['BUY_YES', 'BUY_NO', 'SELL_YES', 'SELL_NO'])

export type TradeBody = {
  marketId: string
  action: 'BUY_YES' | 'BUY_NO' | 'SELL_YES' | 'SELL_NO'
  amountUsd: number
  slippageBps?: number
}

export type SubmitBody = TradeBody & {
  idempotencyKey: string
  confirm: boolean
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new HttpError(400, 'BAD_REQUEST', `${name} is required`)
  }
  return value.trim()
}

function requireNumber(value: unknown, name: string): number {
  const numberValue = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new HttpError(400, 'BAD_REQUEST', `${name} must be a positive number`)
  }
  return numberValue
}

export function parseTradeBody(body: unknown): TradeBody {
  if (!body || typeof body !== 'object') {
    throw new HttpError(400, 'BAD_REQUEST', 'JSON body is required')
  }
  const record = body as Record<string, unknown>
  const action = requireString(record.action, 'action').toUpperCase()
  if (!TRADE_ACTIONS.has(action)) {
    throw new HttpError(400, 'BAD_REQUEST', 'action must be BUY_YES, BUY_NO, SELL_YES, or SELL_NO')
  }

  const slippageBps = record.slippageBps == null ? undefined : Number(record.slippageBps)
  if (slippageBps != null && (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > 5000)) {
    throw new HttpError(400, 'BAD_REQUEST', 'slippageBps must be an integer from 0 through 5000')
  }

  return {
    marketId: requireString(record.marketId, 'marketId'),
    action: action as TradeBody['action'],
    amountUsd: requireNumber(record.amountUsd, 'amountUsd'),
    ...(slippageBps == null ? {} : { slippageBps }),
  }
}

export function parseSubmitBody(config: AppConfig, body: unknown): SubmitBody {
  if (!config.allowSubmitTrades) {
    throw new HttpError(
      403,
      'SUBMIT_DISABLED',
      'submit_trade is disabled in this sample. Set ALLOW_SUBMIT_TRADES=true only for controlled testing.',
    )
  }

  const trade = parseTradeBody(body)
  const record = body as Record<string, unknown>
  const idempotencyKey = requireString(record.idempotencyKey, 'idempotencyKey')
  if (record.confirm !== true) {
    throw new HttpError(400, 'CONFIRMATION_REQUIRED', 'confirm must be true before submit_trade is called')
  }

  return {
    ...trade,
    idempotencyKey,
    confirm: true,
  }
}
