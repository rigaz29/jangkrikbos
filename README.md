# Meridian

**Autonomous Meteora DLMM liquidity management agent for Solana, powered by LLMs.**

Meridian runs continuous screening and management cycles — deploying capital into high-quality Meteora DLMM pools and closing positions based on live PnL, yield, and range data. It learns from every position it closes.

---

## What it does

- **Screens pools** — scans Meteora DLMM pools against configurable thresholds (fee/TVL ratio, organic score, holders, mcap, bin step, volatility) and surfaces high-quality opportunities.
- **Manages positions** — monitors range/PnL/yield, claims fees, and closes positions autonomously. Deterministic exit rules (stop-loss, trailing take-profit, out-of-range, low-yield) run without an LLM; the LLM is only invoked when an action is needed.
- **Learns from performance** — records every closed position, derives structured lessons, and evolves screening thresholds from win/loss history.
- **Telegram control** — full agent chat plus cycle reports, deploy/close notifications, and out-of-range alerts.

---

## How it works

Meridian runs a **ReAct agent loop** — each cycle the LLM reasons over live data, calls tools, and acts. Two specialized agents run on independent cron schedules:

| Agent | Default interval | Role |
|---|---|---|
| **Screening Agent** | Every 30 min | Finds and deploys into the best candidate pool |
| **Management Agent** | Every 10 min | Evaluates each open position and acts (claim / close / hold) |

A lightweight 30-second poller updates trailing take-profit and stop-loss state between management cycles, so exits fire promptly without waiting for the next full cycle.

**Data sources:**
- `@meteora-ag/dlmm` SDK — on-chain position data, active bin, deploy/close transactions
- Meteora DLMM PnL API — position yield, fee accrual, PnL
- OKX OnchainOS — smart-money signals, token risk scoring (public by default; optional API key for higher rate limits)
- Pool discovery API — fee/TVL ratios, volume, organic scores, holders
- Jupiter API — token audit, mcap, launchpad, price stats

Agents are powered via **OpenRouter** by default and can be swapped for any OpenAI-compatible model (including a local one — see [Local model](#using-a-local-model)).

---

## Requirements

- Node.js 18+
- [OpenRouter](https://openrouter.ai) API key (or any OpenAI-compatible endpoint)
- Solana wallet (base58 private key)
- Solana RPC endpoint ([Helius](https://helius.xyz) recommended)
- Telegram bot token (optional — for notifications and chat)

---

## Setup

### 1. Clone & install

```bash
git clone https://github.com/yunus-0x/meridian
cd meridian
npm install
```

### 2. Run the setup wizard

```bash
npm run setup
```

The wizard creates `.env` (API keys, wallet, RPC, OKX, Telegram) and `user-config.json` (risk preset, deploy size, thresholds, model). Takes about two minutes. Press Enter at any prompt to keep the default.

**Or configure manually.** Create `.env`:

```env
WALLET_PRIVATE_KEY=your_base58_private_key
RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
OPENROUTER_API_KEY=sk-or-...
HELIUS_API_KEY=your_helius_key              # optional — richer wallet balances
LPAGENT_API_KEY=your_lpagent_key            # optional — LP position value/PnL data
OKX_API_KEY=                                # optional — OKX OnchainOS enrichment (higher rate limits)
OKX_SECRET_KEY=
OKX_PASSPHRASE=
OKX_PROJECT_ID=                             # OK-ACCESS-PROJECT — required only for OnchainOS APIs
TELEGRAM_BOT_TOKEN=123456:ABC...            # optional — notifications + chat
TELEGRAM_CHAT_ID=                           # required to enable Telegram control
TELEGRAM_ALLOWED_USER_IDS=                  # comma-separated user ids allowed to issue commands
DRY_RUN=true                                # set false for live trading
```

> Keep private keys and API keys in `.env` only — never in `user-config.json`. Both files are gitignored.
>
> `.env` takes precedence over `user-config.json` for `DRY_RUN`. To go live, set `DRY_RUN=false` in `.env` (or re-run `npm run setup`).
>
> **OKX enrichment is optional.** Screening uses OKX's public endpoints by default (no key). Add `OKX_API_KEY` / `OKX_SECRET_KEY` / `OKX_PASSPHRASE` / `OKX_PROJECT_ID` for the authenticated OnchainOS API (higher rate limits) — create a project and key at the [OKX developer portal](https://web3.okx.com/onchainos/dev-docs/home/developer-portal). The setup wizard prompts for these too.

Then copy and edit the config:

```bash
cp user-config.example.json user-config.json
```

See the [Config reference](#config-reference) below.

### 3. Run

```bash
npm run dev    # dry run — no on-chain transactions
npm start      # live mode
```

On startup Meridian fetches your wallet balance, open positions, and top pool candidates, then begins autonomous cycles immediately.

---

## Running the agent

```bash
npm start
```

Starts the autonomous agent with cron-based screening + management cycles and an interactive REPL. The prompt shows a live countdown to the next cycle:

```
[manage: 8m 12s | screen: 24m 3s]
>
```

### REPL commands

| Command | Description |
|---|---|
| `<n>` | Deploy into candidate pool number `n` from the startup list |
| `auto` | Let the agent pick the best candidate and deploy |
| `/status` | Wallet balance and open positions |
| `/candidates` | Re-screen and display top pool candidates |
| `/briefing` | Show the last-24h briefing |
| `/learn [pool]` | Study top LPers (all candidates, or a specific pool address) |
| `/thresholds` | Current screening thresholds and performance stats |
| `/evolve` | Evolve thresholds from performance data (needs 5+ closed positions) |
| `/bootstrap [n]` | Import the last `n` closed positions from the Meteora API and learn from them |
| `/stop` | Graceful shutdown |
| `<anything>` | Free-form chat — ask the agent anything, request actions, analyze pools |

### CLI (optional)

A `meridian` CLI exposes individual tools with JSON output — useful for scripting and debugging:

```bash
node cli.js positions
node cli.js candidates --limit 5
node cli.js deploy --pool <addr> --amount <sol> --strategy bid_ask [--dry-run]
node cli.js close --position <addr> [--dry-run]
node cli.js config get
node cli.js config set screeningModel anthropic/claude-opus-4-5
```

Run `node cli.js --help` for the full command list. `--dry-run` skips on-chain transactions; `--silent` suppresses Telegram notifications.

---

## Telegram

1. Create a bot via [@BotFather](https://t.me/BotFather) and copy the token.
2. Add the token and target chat to `.env`:

```env
TELEGRAM_BOT_TOKEN=<token>
TELEGRAM_CHAT_ID=<target chat id>
TELEGRAM_ALLOWED_USER_IDS=<comma-separated user ids allowed to control the bot>
```

For safety, Meridian does **not** auto-register the first chat that messages it.

- If `TELEGRAM_CHAT_ID` is not set, inbound Telegram control is ignored (notifications still require it too).
- In a group/supergroup, if `TELEGRAM_ALLOWED_USER_IDS` is empty, inbound control is ignored.

### Notifications

Sent automatically for:
- Management cycle reports (reasoning + decisions)
- Screening cycle reports (what it found, whether it deployed)
- Out-of-range alerts past `outOfRangeWaitMinutes`
- Deploy (pair, amount, position, tx) and close (pair, PnL)

### Commands

| Command | Action |
|---|---|
| `/positions` | List open positions with a progress bar |
| `/close <n>` | Close position by list index |
| `/set <n> <note>` | Set an instruction note on a position |
| `/briefing` | Send the last-24h briefing |

You can also chat freely via Telegram using the same interface as the REPL.

---

## How it learns

### Lessons

When a position closes, Meridian records its performance (PnL, range efficiency, hold time, price action, volume trend), derives a concrete lesson, and injects relevant lessons into future agent cycles. Add one manually:

```bash
node cli.js lessons add "Never deploy into pump.fun tokens under 2h old"
```

### Threshold evolution

After 5+ closed positions, Meridian periodically evolves screening thresholds (e.g. `maxVolatility`, `minFeeActiveTvlRatio`, `minOrganic`, `minTvl`) from win/loss data. Trigger it manually anytime:

```bash
node cli.js evolve
```

Changes are written to `user-config.json` and applied immediately.

---

## Config reference

All fields are optional — defaults shown. Edit `user-config.json` or use `node cli.js config set <key> <value>`.

### Screening

| Field | Default | Description |
|---|---|---|
| `minFeeActiveTvlRatio` | `0.05` | Minimum fee/active-TVL ratio |
| `minTvl` / `maxTvl` | `10000` / `150000` | Pool TVL bounds (USD) |
| `minVolume` | `500` | Minimum pool volume |
| `minOrganic` | `60` | Minimum organic score (0–100) |
| `minHolders` | `500` | Minimum token holder count |
| `minMcap` / `maxMcap` | `150000` / `10000000` | Market-cap bounds (USD) |
| `minBinStep` / `maxBinStep` | `80` / `125` | Bin-step bounds |
| `timeframe` | `5m` | Candle timeframe for screening |
| `category` | `trending` | Pool category filter |
| `minTokenFeesSol` | `30` | Minimum all-time pool fees (SOL) |
| `maxVolatility` | `10` | Maximum pool volatility (hard filter, auto-evolved) |
| `maxBotHoldersPct` | `30` | Maximum bot-holder % (hard filter) |
| `maxTop10Pct` | `60` | Maximum top-10 holder concentration (hard filter) |
| `maxBundlePct` | `30` | Bundle-holding % — used as context, not a hard filter |
| `blockedLaunchpads` | `[]` | Launchpad names to never deploy into |
| `allowedLaunchpads` | `[]` | If non-empty, only deploy into these launchpads |

### Management

| Field | Default | Description |
|---|---|---|
| `deployAmountSol` | `0.5` | Base SOL per new position |
| `positionSizePct` | `0.35` | Fraction of deployable balance to use (compounds with wallet) |
| `maxDeployAmount` | `50` | Maximum SOL cap per position |
| `gasReserve` | `0.2` | SOL to keep aside for gas |
| `minSolToOpen` | `0.55` | Minimum wallet SOL before opening |
| `maxPositions` | `3` | Maximum concurrent positions |
| `takeProfitFeePct` | `5` | Static take-profit at this PnL % |
| `trailingTakeProfit` | `true` | Enable trailing take-profit |
| `trailingTriggerPct` / `trailingDropPct` | `3` / `1.5` | Activate trailing at X%, close on Y% drop from peak |
| `stopLossPct` | `-20` | Close if PnL drops to this % |
| `minAgeBeforeSL` | `15` | Minutes before stop-loss can trigger |
| `outOfRangeWaitMinutes` | `30` | Minutes out-of-range before closing |
| `minClaimAmount` | `5` | Minimum unclaimed fees (USD) before claiming |
| `solMode` | `false` | Report values/PnL in SOL instead of USD |

### Schedule

| Field | Default | Description |
|---|---|---|
| `managementIntervalMin` | `10` | Management cycle frequency (minutes) |
| `screeningIntervalMin` | `30` | Screening cycle frequency (minutes) |
| `healthCheckIntervalMin` | `60` | Portfolio health-check frequency (minutes) |

### Models

| Field | Default | Description |
|---|---|---|
| `managementModel` | `openrouter/healer-alpha` | LLM for management cycles |
| `screeningModel` | `openrouter/hunter-alpha` | LLM for screening cycles |
| `generalModel` | `openrouter/healer-alpha` | LLM for REPL / chat |

> Override at runtime: `node cli.js config set screeningModel anthropic/claude-opus-4-5`

---

## Using a local model

Any OpenAI-compatible endpoint works (e.g. LM Studio, Ollama):

```env
LLM_BASE_URL=http://localhost:1234/v1
LLM_API_KEY=lm-studio
LLM_MODEL=your-local-model-name
```

---

## Architecture

```
index.js            Main entry: REPL + cron orchestration + Telegram polling
agent.js            ReAct loop: LLM → tool call → repeat
config.js           Runtime config from user-config.json + .env
prompt.js           System prompt builder (SCREENER / MANAGER / GENERAL roles)
state.js            Position registry + exit-rule engine (state.json)
lessons.js          Learning engine: records performance, derives lessons, evolves thresholds
signal-weights.js   Optional adaptive signal weighting (off by default)
pool-memory.js      Per-pool deploy history + snapshots
strategy-library.js Saved LP strategies
briefing.js         Daily Telegram briefing
telegram.js         Telegram bot: polling + notifications
smart-wallets.js    KOL/alpha wallet tracker
token-blacklist.js  Permanent token blacklist
cli.js              Direct CLI — every tool as a subcommand with JSON output

tools/
  definitions.js    Tool schemas (OpenAI format)
  executor.js       Tool dispatch + safety checks
  dlmm.js           Meteora DLMM SDK wrapper
  screening.js      Pool discovery
  wallet.js         SOL/token balances + Jupiter swap
  token.js          Token info, holders, narrative
  study.js          Top-LPer study
```

---

## Disclaimer

This software is provided as-is, with no warranty. Running an autonomous trading agent carries real financial risk — you can lose funds. Always start with `DRY_RUN=true` to verify behavior before going live, and never deploy more capital than you can afford to lose. This is not financial advice. The authors are not responsible for any losses incurred through use of this software.
