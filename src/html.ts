import type { AppConfig } from './config.js'
import { keyConfiguredSummary } from './redact.js'

export function renderHome(config: AppConfig): string {
  const configJson = JSON.stringify({
    target: config.mcpUrl,
    apiKey: keyConfiguredSummary(config.apiKey),
    submitTrades: config.allowSubmitTrades ? 'enabled' : 'disabled',
    autonomous: config.autonomousTradingEnabled ? 'enabled' : 'disabled',
    autonomousDryRun: config.autonomousDryRun ? 'yes' : 'no',
    autonomousModel: 'simple-open-source-edge-v1',
    autonomousMaxTradeUsd: config.autonomousMaxTradeUsd,
    autonomousDailySpendLimitUsd: config.autonomousDailySpendLimitUsd,
  })

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Endpoint Arena MCP Client Sample</title>
  <style>
    :root {
      color-scheme: light;
      --ink: #191919;
      --muted: #67615b;
      --line: #ddd8cf;
      --paper: #fbfaf7;
      --field: #ffffff;
      --accent: #2f6f24;
      --accent-2: #305a7a;
      --danger: #a33a31;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: var(--paper);
      color: var(--ink);
    }
    main {
      width: min(1120px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }
    header {
      display: grid;
      gap: 10px;
      margin-bottom: 22px;
    }
    h1 {
      margin: 0;
      font-size: clamp(28px, 4vw, 46px);
      line-height: 1;
      letter-spacing: 0;
    }
    p { margin: 0; color: var(--muted); line-height: 1.5; }
    .status-grid, .work-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 12px;
      margin: 12px 0;
    }
    section, form {
      border: 1px solid var(--line);
      background: rgba(255, 255, 255, 0.72);
      border-radius: 8px;
      padding: 16px;
    }
    h2 {
      margin: 0 0 10px;
      font-size: 15px;
      letter-spacing: 0;
    }
    dl {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 8px 12px;
      margin: 0;
      font-size: 14px;
    }
    dt { color: var(--muted); }
    dd { margin: 0; overflow-wrap: anywhere; }
    label {
      display: grid;
      gap: 6px;
      margin: 10px 0;
      font-size: 13px;
      color: var(--muted);
    }
    input, select {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 6px;
      background: var(--field);
      color: var(--ink);
      padding: 10px 11px;
      font: inherit;
    }
    button {
      border: 1px solid #234f1b;
      border-radius: 6px;
      background: var(--accent);
      color: white;
      padding: 10px 12px;
      font: inherit;
      font-weight: 650;
      cursor: pointer;
    }
    button.secondary {
      background: var(--accent-2);
      border-color: #254966;
    }
    pre {
      min-height: 180px;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #111;
      color: #f4f0e8;
      padding: 14px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-size: 12px;
      line-height: 1.45;
    }
    .ok { color: var(--accent); }
    .bad { color: var(--danger); }
    .actions { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 12px; }
  </style>
</head>
<body>
  <main>
    <header>
      <h1>Endpoint Arena MCP Client Sample</h1>
      <p>A standalone Railway app using the public MCP endpoint as an outside client.</p>
    </header>

    <div class="status-grid">
      <section>
        <h2>Configuration</h2>
        <dl id="config"></dl>
        <div class="actions">
          <button type="button" id="run-smoke">Run Smoke</button>
          <button type="button" class="secondary" id="load-markets">Load Markets</button>
          <button type="button" class="secondary" id="run-auto">Run Auto</button>
        </div>
      </section>
      <section>
        <h2>Account Readiness</h2>
        <pre id="account-output">Not loaded.</pre>
      </section>
    </div>

    <div class="work-grid">
      <form id="quote-form">
        <h2>Quote Trade</h2>
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
        <button type="submit">Quote</button>
      </form>
      <section>
        <h2>Result</h2>
        <pre id="result-output">Ready.</pre>
      </section>
    </div>
  </main>
  <script>
    const config = ${configJson};
    const configEl = document.querySelector('#config');
    const accountOut = document.querySelector('#account-output');
    const resultOut = document.querySelector('#result-output');

    configEl.innerHTML = Object.entries(config)
      .map(([key, value]) => '<dt>' + key + '</dt><dd>' + String(value) + '</dd>')
      .join('');

    const show = (el, value) => {
      el.textContent = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    };

    async function request(path, init) {
      const response = await fetch(path, init);
      const payload = await response.json().catch(() => ({ ok: false, error: { message: 'Non-JSON response' } }));
      if (!response.ok) throw payload;
      return payload;
    }

    document.querySelector('#run-smoke').addEventListener('click', async () => {
      show(resultOut, 'Running smoke...');
      try {
        const payload = await request('/api/smoke');
        show(accountOut, payload.account || payload);
        show(resultOut, payload);
      } catch (error) {
        show(resultOut, error);
      }
    });

    document.querySelector('#load-markets').addEventListener('click', async () => {
      show(resultOut, 'Loading markets...');
      try {
        show(resultOut, await request('/api/markets'));
      } catch (error) {
        show(resultOut, error);
      }
    });

    document.querySelector('#run-auto').addEventListener('click', async () => {
      show(resultOut, 'Running autonomous model...');
      try {
        show(resultOut, await request('/api/auto/run', { method: 'POST' }));
      } catch (error) {
        show(resultOut, error);
      }
    });

    document.querySelector('#quote-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget).entries());
      data.amountUsd = Number(data.amountUsd);
      data.slippageBps = Number(data.slippageBps);
      show(resultOut, 'Requesting quote...');
      try {
        show(resultOut, await request('/api/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        }));
      } catch (error) {
        show(resultOut, error);
      }
    });
  </script>
</body>
</html>`
}
