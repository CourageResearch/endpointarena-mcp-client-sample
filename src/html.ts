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
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
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
      font-size: 17px;
      font-weight: 780;
      line-height: 1.2;
      overflow-wrap: anywhere;
    }
    .status-note {
      color: var(--muted);
      font-size: 12px;
      line-height: 1.35;
      overflow-wrap: anywhere;
    }
    .layout {
      display: grid;
      grid-template-columns: minmax(340px, 0.92fr) minmax(360px, 1.08fr);
      gap: 12px;
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
      grid-template-columns: minmax(0, 1fr) auto auto;
      gap: 8px;
      align-items: end;
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
    pre {
      min-height: 172px;
      max-height: 340px;
      overflow: auto;
      border: 1px solid var(--night-line);
      border-radius: 8px;
      background: var(--night);
      color: #edf2ee;
      padding: 14px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 12px;
      line-height: 1.45;
      margin: 0;
      scrollbar-color: #516160 var(--night);
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
      .status-shelf, .quote-grid, .key-row {
        grid-template-columns: 1fr;
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
        <p>${escapeHtml(endpointLabel(config.mcpUrl))}</p>
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
          </div>
          <form id="api-key-form">
            <div class="field-stack">
              <label for="api-key-input">Browser API key</label>
              <div class="key-row">
                <input id="api-key-input" name="apiKey" type="password" autocomplete="off" placeholder="ea_s4_...">
                <button type="submit">Use</button>
                <button type="button" class="ghost" id="clear-key">Clear</button>
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
            <span class="badge neutral" id="account-state">Idle</span>
          </div>
          <pre class="account-output" id="account-output">Not loaded.</pre>
        </section>

        <section class="panel">
          <div class="panel-title-row">
            <h2>Result</h2>
            <span class="badge good" id="result-state">Ready</span>
          </div>
          <pre class="result-output" id="result-output">Ready.</pre>
        </section>
      </div>
    </div>
  </main>
  <script>
    const accountOut = document.querySelector('#account-output');
    const resultOut = document.querySelector('#result-output');
    const accountState = document.querySelector('#account-state');
    const resultState = document.querySelector('#result-state');
    const apiKeyInput = document.querySelector('#api-key-input');
    const rememberKey = document.querySelector('#remember-key');
    const apiKeyStatus = document.querySelector('#api-key-status');
    const apiKeyStorageKey = 'endpointarena:mcp-client-sample:api-key';

    const show = (el, value) => {
      el.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    };

    const setState = (el, text, tone) => {
      el.textContent = text;
      el.className = 'badge ' + tone;
    };

    function setApiKeyStatus() {
      const isSet = Boolean(apiKeyInput.value.trim());
      apiKeyStatus.textContent = isSet ? 'Browser key set' : 'Browser key not set';
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
      return apiKeyInput.value.trim();
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

    document.querySelector('#api-key-form').addEventListener('submit', (event) => {
      event.preventDefault();
      const apiKey = currentApiKey();
      localStorage.removeItem(apiKeyStorageKey);
      sessionStorage.removeItem(apiKeyStorageKey);
      if (apiKey && rememberKey.checked) {
        localStorage.setItem(apiKeyStorageKey, apiKey);
      } else if (apiKey) {
        sessionStorage.setItem(apiKeyStorageKey, apiKey);
      }
      setApiKeyStatus();
      setState(resultState, 'Ready', 'good');
      show(resultOut, apiKey ? 'Browser API key set.' : 'Browser API key cleared.');
    });

    document.querySelector('#clear-key').addEventListener('click', () => {
      apiKeyInput.value = '';
      rememberKey.checked = false;
      localStorage.removeItem(apiKeyStorageKey);
      sessionStorage.removeItem(apiKeyStorageKey);
      setApiKeyStatus();
      setState(resultState, 'Ready', 'good');
      show(resultOut, 'Browser API key cleared.');
    });

    apiKeyInput.addEventListener('input', setApiKeyStatus);

    document.querySelector('#run-smoke').addEventListener('click', async () => {
      setState(accountState, 'Working', 'warn');
      setState(resultState, 'Working', 'warn');
      show(resultOut, 'Running smoke...');
      try {
        const payload = await request('/api/smoke');
        show(accountOut, payload.account || payload);
        show(resultOut, payload);
        setState(accountState, 'Loaded', 'good');
        setState(resultState, 'Complete', 'good');
      } catch (error) {
        show(resultOut, error);
        setState(accountState, 'Idle', 'neutral');
        setState(resultState, 'Error', 'bad');
      }
    });

    document.querySelector('#load-markets').addEventListener('click', async () => {
      setState(resultState, 'Working', 'warn');
      show(resultOut, 'Loading markets...');
      try {
        show(resultOut, await request('/api/markets'));
        setState(resultState, 'Loaded', 'good');
      } catch (error) {
        show(resultOut, error);
        setState(resultState, 'Error', 'bad');
      }
    });

    document.querySelector('#run-auto').addEventListener('click', async () => {
      setState(resultState, 'Working', 'warn');
      show(resultOut, 'Running autonomous model...');
      try {
        show(resultOut, await request('/api/auto/run', { method: 'POST' }));
        setState(resultState, 'Complete', 'good');
      } catch (error) {
        show(resultOut, error);
        setState(resultState, 'Error', 'bad');
      }
    });

    document.querySelector('#quote-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      data.amountUsd = Number(data.amountUsd);
      data.slippageBps = Number(data.slippageBps);
      setState(resultState, 'Working', 'warn');
      show(resultOut, 'Requesting quote...');
      try {
        show(resultOut, await request('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }));
        setState(resultState, 'Quoted', 'good');
      } catch (error) {
        show(resultOut, error);
        setState(resultState, 'Error', 'bad');
      }
    });

    loadBrowserKey();
  </script>
</body>
</html>`
}
