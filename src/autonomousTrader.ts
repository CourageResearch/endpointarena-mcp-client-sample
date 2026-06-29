import type { Client } from '@modelcontextprotocol/sdk/client/index.js'
import type { AppConfig } from './config.js'
import { HttpError } from './errors.js'
import {
  rankAutonomousDecisions,
  type AutonomousDecision,
} from './autonomousModel.js'
import {
  parseToolResult,
  summarizeAccount,
  summarizeMarkets,
  withMcpClient,
} from './mcpClient.js'

type AutonomousOutcome =
  | 'disabled'
  | 'already_running'
  | 'missing_key'
  | 'no_candidate'
  | 'account_not_ready'
  | 'daily_limit_reached'
  | 'quoted_dry_run'
  | 'submit_blocked'
  | 'submitted'
  | 'failed'

export type AutonomousRunResult = {
  ok: boolean
  outcome: AutonomousOutcome
  checkedAt: string
  trigger: 'manual' | 'interval'
  dryRun: boolean
  allowSubmitTrades: boolean
  dailySpendUsd: number
  dailySpendLimitUsd: number
  decision?: AutonomousDecision
  account?: unknown
  markets?: unknown
  quote?: unknown
  submitted?: unknown
  error?: {
    message: string
    code?: string
  }
}

type AutonomousStatus = {
  enabled: boolean
  dryRun: boolean
  running: boolean
  intervalMs: number
  dailySpendUsd: number
  dailySpendLimitUsd: number
  lastRun: AutonomousRunResult | null
  history: AutonomousRunResult[]
}

function utcDay(): string {
  return new Date().toISOString().slice(0, 10)
}

function isReady(account: unknown): boolean {
  const record = account && typeof account === 'object' ? account as Record<string, unknown> : {}
  const readiness = record.readiness && typeof record.readiness === 'object'
    ? record.readiness as Record<string, unknown>
    : {}
  return readiness.canTrade === true
}

function errorResult(error: unknown, trigger: 'manual' | 'interval', config: AppConfig, dailySpendUsd: number): AutonomousRunResult {
  const typed = error instanceof HttpError ? error : null
  const message = error instanceof Error ? error.message : String(error)
  return {
    ok: false,
    outcome: 'failed',
    checkedAt: new Date().toISOString(),
    trigger,
    dryRun: config.autonomousDryRun,
    allowSubmitTrades: config.allowSubmitTrades,
    dailySpendUsd,
    dailySpendLimitUsd: config.autonomousDailySpendLimitUsd,
    error: {
      message,
      code: typed?.code,
    },
  }
}

async function callTool(client: Client, name: string, args: Record<string, unknown> = {}) {
  return parseToolResult(await client.callTool({ name, arguments: args }))
}

export class AutonomousTrader {
  private running = false
  private timer: NodeJS.Timeout | null = null
  private lastRun: AutonomousRunResult | null = null
  private history: AutonomousRunResult[] = []
  private spendDay = utcDay()
  private dailySpendUsd = 0

  constructor(private readonly config: AppConfig) {}

  start() {
    if (!this.config.autonomousTradingEnabled || this.timer) return
    this.timer = setInterval(() => {
      void this.runOnce('interval')
    }, this.config.autonomousIntervalMs)
    void this.runOnce('interval')
  }

  stop() {
    if (!this.timer) return
    clearInterval(this.timer)
    this.timer = null
  }

  status(): AutonomousStatus {
    this.resetDailySpendIfNeeded()
    return {
      enabled: this.config.autonomousTradingEnabled,
      dryRun: this.config.autonomousDryRun,
      running: this.running,
      intervalMs: this.config.autonomousIntervalMs,
      dailySpendUsd: this.dailySpendUsd,
      dailySpendLimitUsd: this.config.autonomousDailySpendLimitUsd,
      lastRun: this.lastRun,
      history: this.history,
    }
  }

  async runOnce(trigger: 'manual' | 'interval' = 'manual'): Promise<AutonomousRunResult> {
    this.resetDailySpendIfNeeded()
    if (!this.config.autonomousTradingEnabled && trigger === 'interval') {
      return this.record({
        ok: true,
        outcome: 'disabled',
        checkedAt: new Date().toISOString(),
        trigger,
        dryRun: this.config.autonomousDryRun,
        allowSubmitTrades: this.config.allowSubmitTrades,
        dailySpendUsd: this.dailySpendUsd,
        dailySpendLimitUsd: this.config.autonomousDailySpendLimitUsd,
      })
    }
    if (!this.config.apiKey) {
      return this.record({
        ok: false,
        outcome: 'missing_key',
        checkedAt: new Date().toISOString(),
        trigger,
        dryRun: this.config.autonomousDryRun,
        allowSubmitTrades: this.config.allowSubmitTrades,
        dailySpendUsd: this.dailySpendUsd,
        dailySpendLimitUsd: this.config.autonomousDailySpendLimitUsd,
        error: {
          message: 'ENDPOINT_ARENA_API_KEY is not configured.',
          code: 'MISSING_API_KEY',
        },
      })
    }
    if (this.running) {
      return this.record({
        ok: false,
        outcome: 'already_running',
        checkedAt: new Date().toISOString(),
        trigger,
        dryRun: this.config.autonomousDryRun,
        allowSubmitTrades: this.config.allowSubmitTrades,
        dailySpendUsd: this.dailySpendUsd,
        dailySpendLimitUsd: this.config.autonomousDailySpendLimitUsd,
      })
    }

    this.running = true
    try {
      const result = await withMcpClient(this.config, async (client) => {
        const account = await callTool(client, 'get_account')
        const markets = await callTool(client, 'list_markets')
        const decisions = rankAutonomousDecisions(markets, this.config)
        const decision = decisions[0]

        if (!decision) {
          return {
            ok: true,
            outcome: 'no_candidate' as const,
            checkedAt: new Date().toISOString(),
            trigger,
            dryRun: this.config.autonomousDryRun,
            allowSubmitTrades: this.config.allowSubmitTrades,
            dailySpendUsd: this.dailySpendUsd,
            dailySpendLimitUsd: this.config.autonomousDailySpendLimitUsd,
            account: summarizeAccount(account),
            markets: summarizeMarkets(markets),
          }
        }

        if (!isReady(account)) {
          return {
            ok: true,
            outcome: 'account_not_ready' as const,
            checkedAt: new Date().toISOString(),
            trigger,
            dryRun: this.config.autonomousDryRun,
            allowSubmitTrades: this.config.allowSubmitTrades,
            dailySpendUsd: this.dailySpendUsd,
            dailySpendLimitUsd: this.config.autonomousDailySpendLimitUsd,
            decision,
            account: summarizeAccount(account),
            markets: summarizeMarkets(markets),
          }
        }

        const remaining = this.config.autonomousDailySpendLimitUsd - this.dailySpendUsd
        if (remaining <= 0) {
          return {
            ok: true,
            outcome: 'daily_limit_reached' as const,
            checkedAt: new Date().toISOString(),
            trigger,
            dryRun: this.config.autonomousDryRun,
            allowSubmitTrades: this.config.allowSubmitTrades,
            dailySpendUsd: this.dailySpendUsd,
            dailySpendLimitUsd: this.config.autonomousDailySpendLimitUsd,
            decision,
            account: summarizeAccount(account),
            markets: summarizeMarkets(markets),
          }
        }

        const amountUsd = Math.min(decision.amountUsd, remaining)
        const trade = {
          marketId: decision.marketId,
          action: decision.action,
          amountUsd,
          slippageBps: decision.slippageBps,
        }
        const quote = await callTool(client, 'quote_trade', trade)
        if (this.config.autonomousDryRun) {
          return {
            ok: true,
            outcome: 'quoted_dry_run' as const,
            checkedAt: new Date().toISOString(),
            trigger,
            dryRun: true,
            allowSubmitTrades: this.config.allowSubmitTrades,
            dailySpendUsd: this.dailySpendUsd,
            dailySpendLimitUsd: this.config.autonomousDailySpendLimitUsd,
            decision: { ...decision, amountUsd },
            account: summarizeAccount(account),
            markets: summarizeMarkets(markets),
            quote,
          }
        }

        if (!this.config.allowSubmitTrades) {
          return {
            ok: false,
            outcome: 'submit_blocked' as const,
            checkedAt: new Date().toISOString(),
            trigger,
            dryRun: false,
            allowSubmitTrades: false,
            dailySpendUsd: this.dailySpendUsd,
            dailySpendLimitUsd: this.config.autonomousDailySpendLimitUsd,
            decision: { ...decision, amountUsd },
            account: summarizeAccount(account),
            markets: summarizeMarkets(markets),
            quote,
            error: {
              message: 'ALLOW_SUBMIT_TRADES is false.',
              code: 'SUBMIT_DISABLED',
            },
          }
        }

        const idempotencyKey = [
          'auto',
          new Date().toISOString().replace(/[^0-9TZ]/g, ''),
          decision.marketId,
          decision.action.toLowerCase(),
        ].join('-')
        const submitted = await callTool(client, 'submit_trade', {
          ...trade,
          idempotencyKey,
        })
        this.dailySpendUsd = Number((this.dailySpendUsd + amountUsd).toFixed(6))
        return {
          ok: true,
          outcome: 'submitted' as const,
          checkedAt: new Date().toISOString(),
          trigger,
          dryRun: false,
          allowSubmitTrades: true,
          dailySpendUsd: this.dailySpendUsd,
          dailySpendLimitUsd: this.config.autonomousDailySpendLimitUsd,
          decision: { ...decision, amountUsd },
          account: summarizeAccount(account),
          markets: summarizeMarkets(markets),
          quote,
          submitted,
        }
      })

      return this.record(result)
    } catch (error) {
      return this.record(errorResult(error, trigger, this.config, this.dailySpendUsd))
    } finally {
      this.running = false
    }
  }

  private resetDailySpendIfNeeded() {
    const currentDay = utcDay()
    if (currentDay === this.spendDay) return
    this.spendDay = currentDay
    this.dailySpendUsd = 0
  }

  private record(result: AutonomousRunResult): AutonomousRunResult {
    this.lastRun = result
    this.history = [result, ...this.history].slice(0, 20)
    console.log(JSON.stringify({
      service: 'endpointarena-mcp-client-sample',
      status: 'autonomous-run',
      outcome: result.outcome,
      trigger: result.trigger,
      dryRun: result.dryRun,
      marketId: result.decision?.marketId,
      action: result.decision?.action,
      edgeBps: result.decision?.edgeBps,
    }))
    return result
  }
}
