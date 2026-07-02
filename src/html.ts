import type { AppConfig } from './config.js'
import { keyConfiguredSummary } from './redact.js'

function escapeHtml(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function endpointLabel(value: string): string {
  try {
    const url = new URL(value)
    return `${url.host}${url.pathname}`
  } catch {
    return value
  }
}

function intervalLabel(value: number): string {
  if (value < 60_000) return `${value}ms`
  const minutes = value / 60_000
  if (Number.isInteger(minutes)) return `${minutes}m`
  return `${minutes.toFixed(1)}m`
}

function moneyLabel(value: number): string {
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 6 })}`
}

export function renderHome(config: AppConfig): string {
  const serverKeyStatus = config.apiKey ? 'configured' : 'missing'
  const serverKeyTone = config.apiKey ? 'good' : 'warn'
  const submitStatus = config.allowSubmitTrades ? 'enabled' : 'disabled'
  const submitTone = config.allowSubmitTrades ? 'warn' : 'good'
  const autoStatus = !config.autonomousTradingEnabled ? 'off' : config.autonomousDryRun ? 'dry run' : 'live'
  const autoTone = !config.autonomousTradingEnabled ? 'neutral' : config.autonomousDryRun ? 'good' : 'warn'

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Endpoint Arena MCP Client Sample</title>
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 16 16%27%3E%3Crect width=%2716%27 height=%2716%27 rx=%273%27 fill=%27%2323673d%27/%3E%3Cpath d=%27M3 5h10v2H3zM3 9h10v2H3z%27 fill=%27white%27/%3E%3C/svg%3E">
  <style>
    :root {
      color-scheme: light;
      --ink: #111817;
      --muted: #5f6b68;
      --soft: #eef2ed;
      --line: #d8dfd8;
      --paper: #f6f7f3;
      --field: #ffffff;
      --panel: #ffffff;
      --green: #23673d;
      --green-ink: #16452a;
      --blue: #245b78;
      --blue-ink: #173f55;
      --amber: #9d5a12;
      --red: #9c3a32;
      --night: #0f1718;
      --night-line: #263335;
      --night-muted: #9aa7a3;
      --shadow: 0 18px 45px rgba(24, 34, 30, 0.08);
      --grid-gap: 12px;
      --left-column-fr: 0.92fr;
      --right-column-fr: 1.08fr;
    }
    * { box-sizing: border-box; }
    html { min-width: 320px; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--paper);
      color: var(--ink);
    }
    body::before {
      content: "";
      display: block;
      height: 6px;
      background:
        linear-gradient(90deg, var(--green) 0 34%, var(--blue) 34% 68%, var(--amber) 68% 82%, #17201f 82%);
    }
    main {
      width: min(1180px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 26px 0 38px;
    }
    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 18px;
      margin-bottom: 18px;
    }
    .header-copy {
      display: grid;
      gap: 6px;
    }
    .eyebrow {
      margin: 0;
      color: var(--blue-ink);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: 0.08em;
      text-transform: uppercase;
    }
    h1 {
      margin: 0;
      font-size: clamp(29px, 4vw, 42px);
      line-height: 1.05;
      letter-spacing: 0;
    }
    p { margin: 0; color: var(--muted); line-height: 1.45; }
    a {
      color: inherit;
      text-decoration: none;
    }
    .pill-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 36px;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--panel);
      color: var(--blue-ink);
      font-size: 13px;
      font-weight: 720;
      padding: 8px 12px;
      white-space: nowrap;
    }
    .status-shelf {
      display: grid;
      grid-template-columns:
        minmax(0, var(--left-column-fr))
        minmax(0, var(--left-column-fr))
        minmax(0, var(--right-column-fr))
        minmax(0, var(--right-column-fr));
      gap: var(--grid-gap);
      margin: 18px 0;
    }
    .status-card, .panel {
      border: 1px solid var(--line);
      background: var(--panel);
      border-radius: 8px;
      box-shadow: var(--shadow);
    }
    .status-card {
      min-height: 112px;
      padding: 14px;
      display: grid;
      align-content: space-between;
      gap: 12px;
      border-top: 4px solid var(--blue);
    }
    .status-card.good { border-top-color: var(--green); }
    .status-card.warn { border-top-color: var(--amber); }
    .status-card.neutral { border-top-color: var(--muted); }
    .status-label {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .status-value {
      color: var(--ink);
      font-size: 16px;
      font-weight: 780;
      line-height: 1.2;
      overflow-wrap: break-word;
    }
    .status-note {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(340px, var(--left-column-fr)) minmax(360px, var(--right-column-fr));
      gap: var(--grid-gap);
      align-items: start;
    }
    .column {
      display: grid;
      gap: 12px;
    }
    .panel {
      padding: 16px;
    }
    .panel-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 12px;
    }
    .panel-controls {
      display: flex;
      align-items: center;
      justify-content: flex-end;
      gap: 8px;
      flex-wrap: wrap;
    }
    .view-toggle {
      display: inline-flex;
      align-items: center;
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--soft);
      padding: 2px;
    }
    .view-toggle-button {
      min-height: 26px;
      border: 0;
      border-radius: 999px;
      background: transparent;
      color: var(--muted);
      padding: 4px 9px;
      font-size: 12px;
      font-weight: 760;
    }
    .view-toggle-button:hover {
      transform: none;
    }
    .view-toggle-button.active {
      background: var(--panel);
      color: var(--blue-ink);
      box-shadow: 0 1px 3px rgba(24, 34, 30, 0.12);
    }
    h2 {
      margin: 0;
      font-size: 15px;
      line-height: 1.2;
      letter-spacing: 0;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 26px;
      border: 1px solid transparent;
      border-radius: 999px;
      padding: 4px 9px;
      font-size: 12px;
      font-weight: 760;
      line-height: 1;
      white-space: nowrap;
    }
    .badge.good, .inline-status.good {
      border-color: #b9d7c4;
      background: #edf7f0;
      color: var(--green-ink);
    }
    .badge.warn, .inline-status.warn {
      border-color: #e6c99f;
      background: #fff5e7;
      color: #754107;
    }
    .badge.bad, .inline-status.bad {
      border-color: #e0bbb7;
      background: #fff0ee;
      color: var(--red);
    }
    .badge.neutral, .inline-status.neutral {
      border-color: var(--line);
      background: var(--soft);
      color: var(--muted);
    }
    .detail-list {
      display: grid;
      gap: 8px;
      margin: 0 0 16px;
    }
    .detail-row {
      display: flex;
      justify-content: space-between;
      gap: 14px;
      border-bottom: 1px solid var(--soft);
      padding-bottom: 8px;
      font-size: 13px;
    }
    .detail-row:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .detail-row span:first-child { color: var(--muted); }
    .detail-row strong {
      color: var(--ink);
      font-size: 13px;
      font-weight: 720;
      text-align: right;
      overflow-wrap: anywhere;
    }
    label {
      display: grid;
      gap: 6px;
      font-size: 13px;
      color: var(--muted);
    }
    .field-stack {
      display: grid;
      gap: 12px;
    }
    .key-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 8px;
      align-items: end;
    }
    .key-actions {
      display: flex;
      gap: 8px;
    }
    .key-input {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      letter-spacing: 0;
    }
    input, select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--field);
      color: var(--ink);
      min-height: 38px;
      padding: 9px 10px;
      font: inherit;
    }
    input:focus, select:focus {
      border-color: var(--blue);
      outline: 3px solid rgba(36, 91, 120, 0.16);
    }
    .checkline {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      margin-top: 10px;
      color: var(--muted);
      font-size: 13px;
    }
    .checkline input {
      width: 16px;
      height: 16px;
      min-height: 16px;
      padding: 0;
    }
    .inline-status {
      display: inline-flex;
      align-items: center;
      width: fit-content;
      border: 1px solid var(--line);
      border-radius: 999px;
      margin-top: 10px;
      padding: 4px 9px;
      font-size: 12px;
      font-weight: 720;
    }
    button {
      min-height: 38px;
      border: 1px solid var(--green-ink);
      border-radius: 6px;
      background: var(--green);
      color: white;
      padding: 9px 12px;
      font: inherit;
      font-weight: 650;
      cursor: pointer;
      white-space: nowrap;
      transition: transform 120ms ease, background-color 120ms ease, border-color 120ms ease;
    }
    button:hover { transform: translateY(-1px); }
    button:active { transform: translateY(0); }
    button.secondary {
      background: var(--blue);
      border-color: var(--blue-ink);
    }
    button.ghost {
      background: var(--field);
      border-color: var(--line);
      color: var(--blue-ink);
    }
    .action-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 14px;
    }
    pre, .human-output {
      min-height: 172px;
      max-height: 340px;
      overflow: auto;
      border-radius: 8px;
      padding: 14px;
      margin: 0;
    }
    pre {
      border: 1px solid var(--night-line);
      background: var(--night);
      color: #edf2ee;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 12px;
      line-height: 1.45;
      scrollbar-color: #516160 var(--night);
    }
    .human-output {
      border: 1px solid var(--line);
      background: #fbfcfa;
      color: var(--ink);
      font-size: 13px;
      line-height: 1.45;
    }
    .human-output[hidden], pre[hidden] {
      display: none;
    }
    .account-output {
      min-height: 188px;
    }
    .result-output {
      min-height: 244px;
    }
    .quote-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .quote-grid label:first-child {
      grid-column: 1 / -1;
    }
    .quote-submit {
      margin-top: 14px;
    }
    .readable {
      display: grid;
      gap: 12px;
    }
    .readable-empty {
      color: var(--muted);
      font-weight: 650;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      gap: 8px;
    }
    .summary-tile {
      border: 1px solid var(--soft);
      border-radius: 8px;
      background: var(--panel);
      padding: 10px;
    }
    .summary-label {
      display: block;
      color: var(--muted);
      font-size: 11px;
      font-weight: 760;
      letter-spacing: 0.04em;
      margin-bottom: 4px;
      text-transform: uppercase;
    }
    .summary-value {
      color: var(--ink);
      font-size: 15px;
      font-weight: 780;
      overflow-wrap: anywhere;
    }
    .readable-section {
      display: grid;
      gap: 7px;
    }
    .readable-title {
      color: var(--muted);
      font-size: 12px;
      font-weight: 760;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .readable-list {
      display: grid;
      gap: 8px;
    }
    .readable-card {
      border: 1px solid var(--soft);
      border-radius: 8px;
      background: var(--panel);
      padding: 10px;
    }
    .readable-card-title {
      color: var(--ink);
      font-weight: 780;
      margin-bottom: 5px;
      overflow-wrap: anywhere;
    }
    .readable-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
      color: var(--muted);
      font-size: 12px;
    }
    .readable-chip {
      border: 1px solid var(--line);
      border-radius: 999px;
      background: var(--soft);
      color: var(--muted);
      padding: 3px 7px;
      font-size: 12px;
      font-weight: 700;
    }
    .readable-note {
      color: var(--muted);
      margin-top: 7px;
      overflow-wrap: anywhere;
    }
    .readable-kv {
      display: grid;
      gap: 6px;
    }
    .readable-row {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 1px solid var(--soft);
      padding-bottom: 6px;
    }
    .readable-row:last-child {
      border-bottom: 0;
      padding-bottom: 0;
    }
    .readable-row span:first-child {
      color: var(--muted);
    }
    .readable-row strong {
      text-align: right;
      overflow-wrap: anywhere;
    }
    @media (max-width: 920px) {
      .status-shelf { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .layout { grid-template-columns: 1fr; }
      .result-output { min-height: 190px; }
    }
    @media (max-width: 620px) {
      main {
        width: min(100% - 20px, 1180px);
        padding-top: 18px;
      }
      .app-header {
        display: grid;
      }
      .panel-title-row {
        align-items: flex-start;
      }
      .status-shelf, .quote-grid, .key-row {
        grid-template-columns: 1fr;
      }
      .key-actions button {
        flex: 1;
      }
      .pill-link {
        width: fit-content;
      }
      .detail-row {
        display: grid;
        gap: 4px;
      }
      .detail-row strong {
        text-align: left;
      }
    }
  </style>
</head>
<body>
  <main>
    <header class="app-header">
      <div class="header-copy">
        <p class="eyebrow">Independent Railway sample</p>
        <h1>Endpoint Arena MCP Console</h1>
      </div>
      <a class="pill-link" href="/health" target="_blank" rel="noreferrer">Health</a>
    </header>

    <div class="status-shelf" aria-label="Runtime status">
      <section class="status-card">
        <span class="status-label">MCP target</span>
        <strong class="status-value">${escapeHtml(endpointLabel(config.mcpUrl))}</strong>
        <span class="status-note">Streamable HTTP</span>
      </section>
      <section class="status-card ${serverKeyTone}">
        <span class="status-label">Server key</span>
        <strong class="status-value">${escapeHtml(serverKeyStatus)}</strong>
        <span class="status-note">${escapeHtml(keyConfiguredSummary(config.apiKey))}</span>
      </section>
      <section class="status-card ${submitTone}">
        <span class="status-label">Submit trades</span>
        <strong class="status-value">${escapeHtml(submitStatus)}</strong>
        <span class="status-note">Quote-first endpoint remains available</span>
      </section>
      <section class="status-card ${autoTone}">
        <span class="status-label">Autonomous mode</span>
        <strong class="status-value">${escapeHtml(autoStatus)}</strong>
        <span class="status-note">${escapeHtml(moneyLabel(config.autonomousMaxTradeUsd))} max, ${escapeHtml(moneyLabel(config.autonomousDailySpendLimitUsd))} daily</span>
      </section>
    </div>

    <div class="layout">
      <div class="column">
        <section class="panel">
          <div class="panel-title-row">
            <h2>Access</h2>
            <span class="badge ${serverKeyTone}">server ${escapeHtml(serverKeyStatus)}</span>
          </div>
          <div class="detail-list">
            <div class="detail-row"><span>Target</span><strong>${escapeHtml(endpointLabel(config.mcpUrl))}</strong></div>
            <div class="detail-row"><span>Model</span><strong>simple-open-source-edge-v1</strong></div>
            <div class="detail-row"><span>Auto cadence</span><strong>${escapeHtml(intervalLabel(config.autonomousIntervalMs))}</strong></div>
            <div class="detail-row"><span>Browser cash</span><strong id="browser-cash-value">not loaded</strong></div>
          </div>
          <form id="api-key-form">
            <div class="field-stack">
              <label for="api-key-input">Browser API key</label>
              <div class="key-row">
                <input class="key-input" id="api-key-input" name="apiKey" type="text" inputmode="text" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="ea_s4_...">
                <div class="key-actions">
                  <button type="button" class="secondary" id="paste-key">Paste</button>
                  <button type="button" class="ghost" id="clear-key">Clear</button>
                </div>
              </div>
            </div>
            <label class="checkline" for="remember-key">
              <input id="remember-key" name="rememberKey" type="checkbox">
              <span>Remember in this browser</span>
            </label>
            <p id="api-key-status" class="inline-status neutral">Browser key not set</p>
          </form>
          <div class="action-row">
            <button type="button" id="run-smoke">Run Smoke</button>
            <button type="button" class="secondary" id="load-markets">Load Markets</button>
            <button type="button" class="secondary" id="run-auto">Run Auto</button>
          </div>
        </section>

        <form class="panel" id="quote-form">
          <div class="panel-title-row">
            <h2>Quote Trade</h2>
            <span class="badge neutral">quote only</span>
          </div>
          <div class="quote-grid">
            <label>Market ID or slug <input name="marketId" autocomplete="off" required></label>
            <label>Action
              <select name="action">
                <option>BUY_YES</option>
                <option>BUY_NO</option>
                <option>SELL_YES</option>
                <option>SELL_NO</option>
              </select>
            </label>
            <label>Amount USDC <input name="amountUsd" type="number" min="0.000001" step="0.000001" value="1" required></label>
            <label>Slippage bps <input name="slippageBps" type="number" min="0" max="5000" step="1" value="100"></label>
          </div>
          <button class="quote-submit" type="submit">Quote</button>
        </form>
      </div>

      <div class="column">
        <section class="panel">
          <div class="panel-title-row">
            <h2>Account Readiness</h2>
            <div class="panel-controls">
              <div class="view-toggle" role="group" aria-label="Account readiness view">
                <button type="button" class="view-toggle-button active" data-output-target="account" data-output-mode="human">Human</button>
                <button type="button" class="view-toggle-button" data-output-target="account" data-output-mode="json">JSON</button>
              </div>
              <span class="badge neutral" id="account-state">Idle</span>
            </div>
          </div>
          <div class="human-output account-output" id="account-human"></div>
          <pre class="account-output" id="account-output" hidden>Not loaded.</pre>
        </section>

        <section class="panel">
          <div class="panel-title-row">
            <h2>Result</h2>
            <div class="panel-controls">
              <div class="view-toggle" role="group" aria-label="Result view">
                <button type="button" class="view-toggle-button active" data-output-target="result" data-output-mode="human">Human</button>
                <button type="button" class="view-toggle-button" data-output-target="result" data-output-mode="json">JSON</button>
              </div>
              <span class="badge good" id="result-state">Ready</span>
            </div>
          </div>
          <div class="human-output result-output" id="result-human"></div>
          <pre class="result-output" id="result-output" hidden>Ready.</pre>
        </section>
      </div>
    </div>
  </main>
  <script>
    const accountHuman = document.querySelector('#account-human');
    const accountOut = document.querySelector('#account-output');
    const resultHuman = document.querySelector('#result-human');
    const resultOut = document.querySelector('#result-output');
    const accountState = document.querySelector('#account-state');
    const resultState = document.querySelector('#result-state');
    const apiKeyInput = document.querySelector('#api-key-input');
    const rememberKey = document.querySelector('#remember-key');
    const apiKeyStatus = document.querySelector('#api-key-status');
    const browserCashValue = document.querySelector('#browser-cash-value');
    const apiKeyStorageKey = 'endpointarena:mcp-client-sample:api-key';
    const normalizeApiKey = (value) => value.replace(/\\s+/g, '').trim();
    let accountRefreshTimer = 0;
    let accountRefreshSeq = 0;
    const outputState = {
      account: { mode: 'human', value: 'Not loaded.' },
      result: { mode: 'human', value: 'Ready.' },
    };
    const outputRefs = {
      account: { human: accountHuman, json: accountOut },
      result: { human: resultHuman, json: resultOut },
    };

    const setState = (el, text, tone) => {
      el.textContent = text;
      el.className = 'badge ' + tone;
    };

    function escapeText(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    function asRecord(value) {
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }

    function getFirst(record, keys) {
      for (const key of keys) {
        if (record[key] !== undefined && record[key] !== null && record[key] !== '') return record[key];
      }
      return undefined;
    }

    function isPrimitive(value) {
      return value === null || ['string', 'number', 'boolean'].includes(typeof value);
    }

    function display(value) {
      if (value === undefined || value === null || value === '') return 'None';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      return String(value);
    }

    function formatKey(key) {
      return String(key)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .replace(/^./, (letter) => letter.toUpperCase());
    }

    function formatMoneyValue(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return display(value);
      return '$' + number.toLocaleString('en-US', { maximumFractionDigits: 6 });
    }

    function formatNumberValue(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return display(value);
      return number.toLocaleString('en-US', { maximumFractionDigits: 6 });
    }

    function formatPercentValue(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return display(value);
      const percent = Math.abs(number) <= 1 ? number * 100 : number;
      return percent.toLocaleString('en-US', { maximumFractionDigits: 2 }) + '%';
    }

    function formatDateValue(value) {
      if (!value) return 'None';
      const date = new Date(String(value));
      if (Number.isNaN(date.getTime())) return display(value);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    }

    function summaryTile(label, value) {
      return '<div class="summary-tile"><span class="summary-label">' + escapeText(label) +
        '</span><div class="summary-value">' + escapeText(display(value)) + '</div></div>';
    }

    function summaryGrid(items) {
      return '<div class="summary-grid">' + items.map(([label, value]) => summaryTile(label, value)).join('') + '</div>';
    }

    function readableSection(title, body) {
      if (!body) return '';
      return '<div class="readable-section"><div class="readable-title">' + escapeText(title) + '</div>' + body + '</div>';
    }

    function chips(values) {
      const html = values
        .filter((value) => value !== undefined && value !== null && value !== '')
        .map((value) => '<span class="readable-chip">' + escapeText(value) + '</span>')
        .join('');
      return html ? '<div class="readable-meta">' + html + '</div>' : '';
    }

    function readableCard(title, meta, note) {
      return '<div class="readable-card"><div class="readable-card-title">' + escapeText(display(title)) +
        '</div>' + chips(meta || []) +
        (note ? '<div class="readable-note">' + escapeText(note) + '</div>' : '') + '</div>';
    }

    function keyValueRows(record, preferredKeys) {
      const source = asRecord(record);
      const keys = preferredKeys && preferredKeys.length ? preferredKeys : Object.keys(source);
      const rows = keys
        .filter((key) => isPrimitive(source[key]))
        .slice(0, 12)
        .map((key) => '<div class="readable-row"><span>' + escapeText(formatKey(key)) +
          '</span><strong>' + escapeText(display(source[key])) + '</strong></div>')
        .join('');
      return rows ? '<div class="readable-kv">' + rows + '</div>' : '';
    }

    function marketList(payload, limit) {
      const record = asRecord(payload);
      const markets = Array.isArray(payload) ? payload : Array.isArray(record.markets) ? record.markets : [];
      if (!markets.length) return '<div class="readable-empty">No markets returned.</div>';
      return '<div class="readable-list">' + markets.slice(0, limit || 8).map((marketValue) => {
        const market = asRecord(marketValue);
        const trial = asRecord(market.trial);
        const prices = asRecord(market.prices);
        const activity = asRecord(market.activity);
        const priceMeta = [];
        if (prices.yes !== undefined) priceMeta.push(formatPercentValue(prices.yes) + ' YES');
        if (prices.no !== undefined) priceMeta.push(formatPercentValue(prices.no) + ' NO');
        if (activity.volumeUsd !== undefined) priceMeta.push(formatMoneyValue(activity.volumeUsd) + ' vol');
        if (activity.tradeCount !== undefined) priceMeta.push(formatNumberValue(activity.tradeCount) + ' trades');
        const meta = [
          market.marketId,
          market.status,
          market.resolvedOutcome ? 'Resolved ' + market.resolvedOutcome : '',
          trial.sponsorTicker || trial.sponsorName,
          trial.phase,
          market.closeTime ? formatDateValue(market.closeTime) : '',
          ...priceMeta,
        ];
        const note = trial.summary || trial.marketPrimaryEndpoint || market.summary || '';
        return readableCard(market.title || market.marketId || 'Market', meta, note);
      }).join('') + '</div>';
    }

    function accountSummary(payload) {
      const account = asRecord(payload);
      const readiness = asRecord(account.readiness);
      const balances = asRecord(account.balances);
      const environment = asRecord(account.environment);
      const tiles = summaryGrid([
        ['Can trade', readiness.canTrade === true ? 'Yes' : 'No'],
        ['Cash', formatMoneyValue(balances.cashUsd)],
        ['Needs setup', readiness.needsWebSetup === true || readiness.needsTradingSetup === true ? 'Yes' : 'No'],
        ['Needs funds', readiness.needsFunds === true ? 'Yes' : 'No'],
      ]);
      const message = readiness.message
        ? readableSection('Readiness message', readableCard(readiness.message, [
          environment.season,
          environment.mode,
          environment.realMoney === true ? 'real money' : environment.realMoney === false ? 'real money disabled' : '',
        ]))
        : '';
      const missing = Array.isArray(environment.missing) && environment.missing.length
        ? readableSection('Missing production checks', chips(environment.missing))
        : '';
      return tiles + message + missing;
    }

    function renderAccount(payload) {
      return '<div class="readable">' + accountSummary(payload) + '</div>';
    }

    function renderMarkets(payload) {
      const record = asRecord(payload);
      const count = record.count !== undefined ? record.count : Array.isArray(record.markets) ? record.markets.length : 0;
      return '<div class="readable">' +
        summaryGrid([['Markets', count], ['Showing', Math.min(Number(count) || 0, 8)]]) +
        readableSection('Markets', marketList(payload, 8)) +
        '</div>';
    }

    function renderMarket(payload) {
      return '<div class="readable">' + readableSection('Market', marketList([payload], 1)) + keyValueRows(asRecord(payload), [
        'marketId',
        'status',
        'resolvedOutcome',
        'closeTime',
      ]) + '</div>';
    }

    function renderSmoke(payload) {
      const record = asRecord(payload);
      const server = asRecord(record.server);
      const tools = Array.isArray(record.tools) ? record.tools : [];
      const resources = Array.isArray(record.resources) ? record.resources : [];
      const prompts = Array.isArray(record.prompts) ? record.prompts : [];
      const markets = asRecord(record.markets);
      const account = asRecord(record.account);
      const readiness = asRecord(account.readiness);
      const toolNames = tools.map((toolValue) => {
        const tool = asRecord(toolValue);
        return tool.name ? tool.name + (tool.destructive ? ' destructive' : '') : '';
      });
      return '<div class="readable">' +
        summaryGrid([
          ['Smoke', record.ok === true ? 'Passing' : 'Failed'],
          ['Server', server.title || server.name || 'Unknown'],
          ['Tools', tools.length],
          ['Markets', markets.count || 0],
        ]) +
        readableSection('Account', accountSummary(account)) +
        readableSection('Tools', chips(toolNames)) +
        readableSection('Resources', chips(resources.map((resourceValue) => asRecord(resourceValue).title || asRecord(resourceValue).name))) +
        readableSection('Prompts', chips(prompts.map((promptValue) => asRecord(promptValue).title || asRecord(promptValue).name))) +
        readableSection('Markets', marketList(markets, 5)) +
        (readiness.message ? readableSection('Bottom line', readableCard(readiness.message, [])) : '') +
        '</div>';
    }

    function renderQuote(payload) {
      const outer = asRecord(payload);
      const quote = asRecord(outer.quote || payload);
      const trade = asRecord(quote.trade || quote.request || quote.order);
      const market = asRecord(quote.market);
      return '<div class="readable">' +
        summaryGrid([
          ['Quote', outer.ok === false ? 'Failed' : 'Ready'],
          ['Market', getFirst(quote, ['marketId', 'marketIdentifier', 'identifier']) || market.marketId || trade.marketId],
          ['Action', getFirst(quote, ['action', 'side']) || trade.action],
          ['Amount', formatMoneyValue(getFirst(quote, ['amountUsd', 'notionalUsd', 'maxCostUsd']) || trade.amountUsd)],
        ]) +
        readableSection('Quote details', keyValueRows(quote, [
          'estimatedShares',
          'shares',
          'price',
          'averagePrice',
          'maxCostUsd',
          'feeUsd',
          'slippageBps',
          'message',
        ])) +
        '</div>';
    }

    function renderAuto(payload) {
      const outer = asRecord(payload);
      const auto = asRecord(outer.autonomous || payload);
      const decision = asRecord(auto.decision);
      return '<div class="readable">' +
        summaryGrid([
          ['Outcome', auto.outcome || (auto.ok === false ? 'failed' : 'complete')],
          ['Dry run', auto.dryRun === true ? 'Yes' : 'No'],
          ['Daily spend', formatMoneyValue(auto.dailySpendUsd) + ' / ' + formatMoneyValue(auto.dailySpendLimitUsd)],
          ['Decision', decision.action || 'None'],
        ]) +
        readableSection('Selected trade', decision.marketId ? readableCard(decision.marketTitle || decision.marketId, [
          decision.marketId,
          decision.action,
          decision.edgeBps !== undefined ? formatNumberValue(decision.edgeBps) + ' bps edge' : '',
          decision.amountUsd !== undefined ? formatMoneyValue(decision.amountUsd) : '',
        ], decision.reason || '') : '<div class="readable-empty">No trade selected.</div>') +
        (auto.account ? readableSection('Account', accountSummary(auto.account)) : '') +
        (auto.markets ? readableSection('Markets reviewed', marketList(auto.markets, 5)) : '') +
        (auto.quote ? readableSection('Quote', renderQuote(auto.quote)) : '') +
        (auto.error ? readableSection('Error', renderError(auto.error)) : '') +
        '</div>';
    }

    function renderError(errorValue) {
      const error = asRecord(errorValue);
      return readableCard(error.message || 'Request failed', [error.code || '', error.status || ''], '');
    }

    function renderFallback(payload) {
      const record = asRecord(payload);
      const rows = keyValueRows(record);
      return '<div class="readable">' + (rows || '<div class="readable-empty">No summary available. Switch to JSON for the raw response.</div>') + '</div>';
    }

    function renderHuman(target, value) {
      if (typeof value === 'string') return '<div class="readable-empty">' + escapeText(value) + '</div>';
      const record = asRecord(value);
      if (record.error) return '<div class="readable">' + readableSection('Error', renderError(record.error)) + '</div>';
      if (record.tools && record.account && record.markets) return renderSmoke(record);
      if (record.account) return renderAccount(record.account);
      if (record.autonomous) return renderAuto(record);
      if (record.quote) return renderQuote(record);
      if (record.market) return renderMarket(record.market);
      if (Array.isArray(record.markets) || record.count !== undefined) return renderMarkets(record);
      if (record.readiness || target === 'account') return renderAccount(record);
      return renderFallback(record);
    }

    function renderOutput(target) {
      const state = outputState[target];
      const refs = outputRefs[target];
      const jsonMode = state.mode === 'json';
      refs.json.textContent = typeof state.value === 'string' ? state.value : JSON.stringify(state.value, null, 2);
      refs.human.innerHTML = renderHuman(target, state.value);
      refs.json.hidden = !jsonMode;
      refs.human.hidden = jsonMode;
      document.querySelectorAll('[data-output-target="' + target + '"]').forEach((button) => {
        const active = button.dataset.outputMode === state.mode;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
      });
    }

    function showOutput(target, value) {
      outputState[target].value = value;
      renderOutput(target);
    }

    function setApiKeyStatus() {
      const isSet = Boolean(currentApiKey());
      apiKeyStatus.textContent = isSet ? 'Browser key active' : 'Browser key not set';
      apiKeyStatus.className = 'inline-status ' + (isSet ? 'good' : 'neutral');
    }

    function loadBrowserKey() {
      const remembered = localStorage.getItem(apiKeyStorageKey);
      const session = sessionStorage.getItem(apiKeyStorageKey);
      const value = remembered || session || '';
      apiKeyInput.value = value;
      rememberKey.checked = Boolean(remembered);
      setApiKeyStatus();
    }

    function currentApiKey() {
      return normalizeApiKey(apiKeyInput.value);
    }

    function storeBrowserKey(apiKey) {
      localStorage.removeItem(apiKeyStorageKey);
      sessionStorage.removeItem(apiKeyStorageKey);
      if (apiKey && rememberKey.checked) {
        localStorage.setItem(apiKeyStorageKey, apiKey);
      } else if (apiKey) {
        sessionStorage.setItem(apiKeyStorageKey, apiKey);
      }
    }

    function activateBrowserKey(options) {
      const apiKey = currentApiKey();
      storeBrowserKey(apiKey);
      setApiKeyStatus();
      scheduleAccountRefresh(options && options.immediate ? 0 : 650);
      if (!options || !options.announce) return;
      setState(resultState, 'Ready', 'good');
      showOutput('result', options.message || (apiKey ? 'Browser API key is active.' : 'Browser API key cleared.'));
    }

    function requestHeaders(initHeaders) {
      const headers = new Headers(initHeaders || {});
      const apiKey = currentApiKey();
      if (apiKey) headers.set('X-Endpoint-Arena-Api-Key', apiKey);
      return headers;
    }

    async function request(path, init) {
      const headers = requestHeaders(init && init.headers);
      const response = await fetch(path, { ...(init || {}), headers });
      const payload = await response.json().catch(() => ({ ok: false, error: { message: 'Non-JSON response' } }));
      if (!response.ok) throw payload;
      return payload;
    }

    function resetBrowserAccount() {
      accountRefreshSeq += 1;
      window.clearTimeout(accountRefreshTimer);
      browserCashValue.textContent = 'not loaded';
      setState(accountState, 'Idle', 'neutral');
      showOutput('account', 'Not loaded.');
    }

    function scheduleAccountRefresh(delay) {
      window.clearTimeout(accountRefreshTimer);
      const apiKey = currentApiKey();
      if (!apiKey) {
        resetBrowserAccount();
        return;
      }
      if (apiKey.length < 12) {
        accountRefreshSeq += 1;
        browserCashValue.textContent = 'enter key';
        setState(accountState, 'Idle', 'neutral');
        showOutput('account', 'Enter an API key to load account.');
        return;
      }
      browserCashValue.textContent = 'loading...';
      setState(accountState, 'Working', 'warn');
      accountRefreshTimer = window.setTimeout(() => {
        void refreshBrowserAccount();
      }, delay);
    }

    async function refreshBrowserAccount() {
      const seq = accountRefreshSeq + 1;
      accountRefreshSeq = seq;
      const apiKey = currentApiKey();
      if (!apiKey) {
        resetBrowserAccount();
        return;
      }
      try {
        const payload = await request('/api/account');
        if (seq !== accountRefreshSeq || apiKey !== currentApiKey()) return;
        const account = asRecord(payload.account || payload);
        const balances = asRecord(account.balances);
        browserCashValue.textContent = formatMoneyValue(balances.cashUsd);
        showOutput('account', account);
        setState(accountState, 'Loaded', 'good');
      } catch (error) {
        if (seq !== accountRefreshSeq || apiKey !== currentApiKey()) return;
        browserCashValue.textContent = 'unavailable';
        showOutput('account', error);
        setState(accountState, 'Error', 'bad');
      }
    }

    document.querySelector('#api-key-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const apiKey = currentApiKey();
      apiKeyInput.value = apiKey;
      activateBrowserKey({ announce: true });
    });

    document.querySelector('#paste-key').addEventListener('click', async () => {
      try {
        const pasted = normalizeApiKey(await navigator.clipboard.readText());
        if (!pasted) {
          setState(resultState, 'Ready', 'good');
          showOutput('result', 'Clipboard is empty.');
          apiKeyInput.focus();
          return;
        }
        apiKeyInput.value = pasted;
        activateBrowserKey({ announce: true, immediate: true, message: 'Browser API key pasted and active.' });
        apiKeyInput.focus();
      } catch {
        setState(resultState, 'Ready', 'good');
        showOutput('result', 'Clipboard access was blocked. Click the key field and press Cmd+V.');
        apiKeyInput.focus();
      }
    });

    document.querySelector('#clear-key').addEventListener('click', () => {
      apiKeyInput.value = '';
      rememberKey.checked = false;
      localStorage.removeItem(apiKeyStorageKey);
      sessionStorage.removeItem(apiKeyStorageKey);
      setApiKeyStatus();
      resetBrowserAccount();
      setState(resultState, 'Ready', 'good');
      showOutput('result', 'Browser API key cleared.');
    });

    apiKeyInput.addEventListener('input', () => activateBrowserKey());
    apiKeyInput.addEventListener('paste', () => {
      setTimeout(() => {
        apiKeyInput.value = currentApiKey();
        activateBrowserKey({ announce: true, immediate: true, message: currentApiKey() ? 'Browser API key pasted and active.' : 'Browser API key cleared.' });
      }, 0);
    });
    rememberKey.addEventListener('change', () => activateBrowserKey());

    document.querySelector('#run-smoke').addEventListener('click', async () => {
      setState(accountState, 'Working', 'warn');
      setState(resultState, 'Working', 'warn');
      showOutput('result', 'Running smoke...');
      try {
        const payload = await request('/api/smoke');
        showOutput('account', payload.account || payload);
        showOutput('result', payload);
        setState(accountState, 'Loaded', 'good');
        setState(resultState, 'Complete', 'good');
      } catch (error) {
        showOutput('result', error);
        setState(accountState, 'Idle', 'neutral');
        setState(resultState, 'Error', 'bad');
      }
    });

    document.querySelector('#load-markets').addEventListener('click', async () => {
      setState(resultState, 'Working', 'warn');
      showOutput('result', 'Loading markets...');
      try {
        showOutput('result', await request('/api/markets'));
        setState(resultState, 'Loaded', 'good');
      } catch (error) {
        showOutput('result', error);
        setState(resultState, 'Error', 'bad');
      }
    });

    document.querySelector('#run-auto').addEventListener('click', async () => {
      setState(resultState, 'Working', 'warn');
      showOutput('result', 'Running autonomous model...');
      try {
        showOutput('result', await request('/api/auto/run', { method: 'POST' }));
        setState(resultState, 'Complete', 'good');
      } catch (error) {
        showOutput('result', error);
        setState(resultState, 'Error', 'bad');
      }
    });

    document.querySelector('#quote-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      data.amountUsd = Number(data.amountUsd);
      data.slippageBps = Number(data.slippageBps);
      setState(resultState, 'Working', 'warn');
      showOutput('result', 'Requesting quote...');
      try {
        showOutput('result', await request('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }));
        setState(resultState, 'Quoted', 'good');
      } catch (error) {
        showOutput('result', error);
        setState(resultState, 'Error', 'bad');
      }
    });

    document.querySelectorAll('[data-output-target]').forEach((button) => {
      button.addEventListener('click', () => {
        outputState[button.dataset.outputTarget].mode = button.dataset.outputMode;
        renderOutput(button.dataset.outputTarget);
      });
    });

    loadBrowserKey();
    renderOutput('account');
    renderOutput('result');
    if (currentApiKey()) scheduleAccountRefresh(0);
  </script>
</body>
</html>`
}
