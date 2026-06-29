import type { AppConfig } from './config.js'
import type { TradeBody } from './safety.js'

export const OPEN_SOURCE_MODEL_NAME = 'simple-open-source-edge-v1'
export const OPEN_SOURCE_MODEL_LICENSE = 'MIT'

type MarketRecord = Record<string, unknown>

export type AutonomousDecision = {
  model: {
    name: string
    license: string
  }
  marketId: string
  title: string | null
  action: TradeBody['action']
  modelProbabilityYes: number
  marketPrice: number
  edgeBps: number
  amountUsd: number
  slippageBps: number
  reason: string
}

function asRecord(value: unknown): MarketRecord {
  return value && typeof value === 'object' ? value as MarketRecord : {}
}

function asNumber(value: unknown): number | null {
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function marketTitle(market: MarketRecord): string | null {
  return asString(market.title)
}

function marketId(market: MarketRecord): string | null {
  return asString(market.marketId) ?? asString(market.slug)
}

function phaseBias(phase: string | null): number {
  const normalized = phase?.toLowerCase() ?? ''
  if (normalized.includes('phase 3')) return 0.035
  if (normalized.includes('phase 2/phase 3')) return 0.025
  if (normalized.includes('phase 2')) return 0.01
  if (normalized.includes('phase 1')) return -0.035
  return 0
}

function statusBias(status: string | null): number {
  const normalized = status?.toLowerCase() ?? ''
  if (normalized.includes('active not recruiting') || normalized.includes('active, not recruiting')) return 0.015
  if (normalized.includes('recruiting')) return 0.005
  if (normalized.includes('terminated') || normalized.includes('withdrawn') || normalized.includes('suspended')) return -0.08
  return 0
}

function activityBias(activity: MarketRecord): number {
  const volumeUsd = asNumber(activity.volumeUsd) ?? 0
  const tradeCount = asNumber(activity.tradeCount) ?? 0
  if (volumeUsd > 100 || tradeCount >= 10) return 0.01
  if (volumeUsd <= 0 && tradeCount <= 0) return -0.01
  return 0
}

export function modelProbabilityYes(market: unknown): number {
  const record = asRecord(market)
  const trial = asRecord(record.trial)
  const activity = asRecord(record.activity)
  const endpointConfidence = asNumber(trial.marketEndpointConfidence)
  const confidenceBias = endpointConfidence == null
    ? 0
    : clamp((endpointConfidence - 80) / 1_000, -0.04, 0.04)

  return clamp(
    0.5
      + confidenceBias
      + phaseBias(asString(trial.phase))
      + statusBias(asString(trial.currentStatus))
      + activityBias(activity),
    0.08,
    0.92,
  )
}

export function rankAutonomousDecisions(marketsPayload: unknown, config: AppConfig): AutonomousDecision[] {
  const payload = asRecord(marketsPayload)
  const markets = Array.isArray(payload.markets) ? payload.markets : []
  const allowlist = new Set(config.autonomousMarketAllowlist.map((item) => item.toLowerCase()))

  return markets.flatMap((market): AutonomousDecision[] => {
    const record = asRecord(market)
    const id = marketId(record)
    if (!id) return []
    if (allowlist.size > 0 && !allowlist.has(id.toLowerCase())) return []
    if (asString(record.status)?.toLowerCase() !== 'deployed') return []
    if (record.resolvedOutcome != null) return []

    const prices = asRecord(record.prices)
    const priceYes = asNumber(prices.yes)
    const priceNo = asNumber(prices.no)
    if (priceYes == null || priceNo == null || priceYes <= 0 || priceNo <= 0) return []

    const probabilityYes = modelProbabilityYes(record)
    const yesEdge = probabilityYes - priceYes
    const noEdge = (1 - probabilityYes) - priceNo
    const action: TradeBody['action'] = yesEdge >= noEdge ? 'BUY_YES' : 'BUY_NO'
    const edge = action === 'BUY_YES' ? yesEdge : noEdge
    const edgeBps = Math.round(edge * 10_000)
    if (edgeBps < config.autonomousMinEdgeBps) return []

    return [{
      model: {
        name: OPEN_SOURCE_MODEL_NAME,
        license: OPEN_SOURCE_MODEL_LICENSE,
      },
      marketId: id,
      title: marketTitle(record),
      action,
      modelProbabilityYes: Number(probabilityYes.toFixed(6)),
      marketPrice: Number((action === 'BUY_YES' ? priceYes : priceNo).toFixed(6)),
      edgeBps,
      amountUsd: config.autonomousMaxTradeUsd,
      slippageBps: config.autonomousSlippageBps,
      reason: [
        'Toy open-source edge model compares its probability estimate with current market prices.',
        `Selected ${action} because estimated edge is ${edgeBps} bps.`,
        'This is a sample model, not investment advice.',
      ].join(' '),
    }]
  }).sort((left, right) => right.edgeBps - left.edgeBps)
}
