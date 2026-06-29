/**
 * Config schema — single source of truth for every runtime config key:
 * its section (in the nested `config` object), default value, and help text.
 *
 * - config.js builds the nested `config` object directly from this schema.
 * - setup.js writes a COMPLETE user-config.json (every key, no hidden default)
 *   plus a `_help` block from these descriptions.
 *
 * Each entry: { key, section, def, help }.
 * `section: "root"` means the key sits at the top level of `config` (e.g. darwin).
 * Special fallbacks that this flat shape can't express (stopLossPct legacy alias,
 * per-role model env fallback) are layered on top in config.js.
 */
export const CONFIG_SCHEMA = [
  // ─── Risk ───────────────────────────────────────────────────────────────
  { key: "maxPositions",          section: "risk", def: 3,        help: "Max concurrent open LP positions." },

  // ─── Screening ──────────────────────────────────────────────────────────
  { key: "minFeeActiveTvlRatio",  section: "screening", def: 0.05,     help: "Min fee/active-TVL ratio (%), measured over `timeframe`. Scale this with the timeframe." },
  { key: "minTvl",                section: "screening", def: 10000,    help: "Min pool TVL (USD)." },
  { key: "maxTvl",                section: "screening", def: 150000,   help: "Max pool TVL (USD)." },
  { key: "minVolume",             section: "screening", def: 500,      help: "Min pool volume (USD) over `timeframe`. Scale this with the timeframe." },
  { key: "minOrganic",            section: "screening", def: 60,       help: "Min Jupiter organic score (0-100)." },
  { key: "minHolders",            section: "screening", def: 500,      help: "Min base-token holder count." },
  { key: "minMcap",               section: "screening", def: 150000,   help: "Min base-token market cap (USD)." },
  { key: "maxMcap",               section: "screening", def: 10000000, help: "Max base-token market cap (USD)." },
  { key: "minBinStep",            section: "screening", def: 80,       help: "Min DLMM bin step allowed for deploy." },
  { key: "maxBinStep",            section: "screening", def: 125,      help: "Max DLMM bin step allowed for deploy." },
  { key: "timeframe",             section: "screening", def: "5m",     help: "Screening window: 5m|15m|1h|2h|4h|24h. Pool metrics (volume, fee/TVL, volatility) are measured over this window." },
  { key: "category",              section: "screening", def: "trending", help: "Meteora pool-discovery category filter (e.g. trending, top)." },
  { key: "minTokenFeesSol",       section: "screening", def: 30,       help: "Min all-time global fees paid by the token (SOL). Below this = likely bundled/scam. Hard rule." },
  { key: "maxBundlePct",          section: "screening", def: 30,       help: "Max bundle-holding % (OKX). Context only, NOT a hard filter." },
  { key: "maxBotHoldersPct",      section: "screening", def: 30,       help: "Max bot-holder % (Jupiter audit). Hard filter." },
  { key: "maxTop10Pct",           section: "screening", def: 60,       help: "Max top-10 holder concentration %. Hard filter." },
  { key: "blockedLaunchpads",     section: "screening", def: [],       help: "Launchpads to never deploy into, e.g. [\"pump.fun\", \"letsbonk.fun\"]." },
  { key: "allowedLaunchpads",     section: "screening", def: [],       help: "If non-empty, only deploy into these launchpads." },
  { key: "minTokenAgeHours",      section: "screening", def: null,     help: "Min token age in hours (null = no minimum)." },
  { key: "maxTokenAgeHours",      section: "screening", def: null,     help: "Max token age in hours (null = no maximum)." },
  { key: "athFilterPct",          section: "screening", def: null,     help: "Only deploy if price is >= this % below ATH, e.g. -20 (null = off). Avoids buying near the top." },
  { key: "maxAthDropPct",         section: "screening", def: null,     help: "Skip pools already down more than this % from ATH, e.g. 80 = avoid tokens down >=80% from ATH (dead/slow-rug). null = off." },
  { key: "maxVolatility",         section: "screening", def: 10,       help: "Max pool volatility at screening time (~0-5 typical, 5+ high). Hard filter." },

  // ─── Management ─────────────────────────────────────────────────────────
  { key: "minClaimAmount",        section: "management", def: 5,        help: "Min unclaimed fees (USD) before claiming." },
  { key: "autoSwapAfterClaim",    section: "management", def: false,    help: "Auto-swap claimed base token back to SOL after a standalone claim." },
  { key: "autoSweepStranded",     section: "management", def: true,     help: "Each management cycle, swap stray non-SOL tokens (>= $0.10, excluding open-position tokens & stables) back to SOL. Safety net for closes that landed but errored." },
  { key: "outOfRangeBinsToClose", section: "management", def: 10,       help: "Fallback bin count for the pumped-far-above close when outOfRangePctToClose is unset or bin_step is unknown." },
  { key: "outOfRangePctToClose",  section: "management", def: 20,       help: "Close when price pumps this % ABOVE the range (converted to bins per pool's bin_step — consistent across pools). Null → fall back to outOfRangeBinsToClose." },
  { key: "outOfRangeWaitMinutes", section: "management", def: 30,       help: "Minutes out-of-range before closing." },
  { key: "oorCooldownTriggerCount", section: "management", def: 3,      help: "OOR closes within the window before a pool/token goes on cooldown." },
  { key: "oorCooldownHours",      section: "management", def: 12,       help: "Cooldown duration (hours) after repeated OOR closes." },
  { key: "stopLossPct",           section: "management", def: -20,      help: "Close if PnL drops to this % (negative)." },
  { key: "minAgeBeforeSL",        section: "management", def: 15,       help: "Minutes before stop-loss can trigger." },
  { key: "takeProfitFeePct",      section: "management", def: 5,        help: "Static take-profit when PnL reaches this %." },
  { key: "minFeePerTvl24h",       section: "management", def: 7,        help: "Min fee/TVL (24h, fixed window) before closing for low yield." },
  { key: "minAgeBeforeYieldCheck", section: "management", def: 60,      help: "Minutes before the low-yield close rule can trigger." },
  { key: "minSolToOpen",          section: "management", def: 0.55,     help: "Min wallet SOL before opening a new position." },
  { key: "deployAmountSol",       section: "management", def: 0.5,      help: "Fixed SOL deployed per new position." },
  { key: "gasReserve",            section: "management", def: 0.2,      help: "SOL kept aside for gas." },
  { key: "trailingTakeProfit",    section: "management", def: true,     help: "Enable trailing take-profit." },
  { key: "trailingTriggerPct",    section: "management", def: 3,        help: "Activate trailing once PnL reaches this %." },
  { key: "trailingDropPct",       section: "management", def: 1.5,      help: "Close when PnL drops this % from the confirmed peak." },
  { key: "pnlSanityMaxDiffPct",   section: "management", def: 5,        help: "Max diff between reported and derived PnL % before ignoring a tick." },
  { key: "solMode",               section: "management", def: false,    help: "Report positions/PnL/balances in SOL instead of USD." },

  // ─── Strategy ───────────────────────────────────────────────────────────
  { key: "strategy",              section: "strategy", def: "bid_ask", help: "Fallback LP strategy when volatility isn't provided (manual deploys): bid_ask|spot." },
  { key: "volatilityStrategyThreshold", section: "strategy", def: 2.5, help: "Pool volatility >= this => bid_ask (high-vol, OOR-resilient, accumulate dips); below => spot (two-sided fee farming). Drives strategy deterministically on autonomous deploys." },
  { key: "targetDownsidePct",     section: "strategy", def: 0.35,     help: "Fallback downside range % when the strategy-specific key is unset." },
  { key: "targetDownsideBidAsk",  section: "strategy", def: 0.40,     help: "Downside range % for bid_ask (high-vol, accumulate dips → wider). Falls back to targetDownsidePct." },
  { key: "targetDownsideSpot",    section: "strategy", def: 0.30,     help: "Downside range % for spot (calmer token → tighter). Falls back to targetDownsidePct." },
  { key: "targetUpsidePct",       section: "strategy", def: 0.20,     help: "Bin range covers this % price rise above the active bin (spot only)." },

  // ─── Schedule ───────────────────────────────────────────────────────────
  { key: "managementIntervalMin", section: "schedule", def: 10,       help: "Management cycle frequency (minutes)." },
  { key: "screeningIntervalMin",  section: "schedule", def: 30,       help: "Screening cycle frequency (minutes)." },
  { key: "healthCheckIntervalMin", section: "schedule", def: 60,      help: "Portfolio health-check frequency (minutes)." },

  // ─── LLM ────────────────────────────────────────────────────────────────
  // managementModel/screeningModel/generalModel also fall back to env LLM_MODEL (see config.js).
  { key: "temperature",           section: "llm", def: 0.373,    help: "LLM sampling temperature." },
  { key: "maxTokens",             section: "llm", def: 4096,     help: "Max output tokens per LLM call." },
  { key: "maxSteps",              section: "llm", def: 20,       help: "Max ReAct steps per agent run." },
  { key: "managementModel",       section: "llm", def: "openrouter/healer-alpha", help: "Model for management cycles (falls back to env LLM_MODEL)." },
  { key: "screeningModel",        section: "llm", def: "openrouter/hunter-alpha", help: "Model for screening cycles (falls back to env LLM_MODEL)." },
  { key: "generalModel",          section: "llm", def: "openrouter/healer-alpha", help: "Model for REPL / chat (falls back to env LLM_MODEL)." },

  // ─── Darwin (optional adaptive signal weights) — top-level config.darwin ─
  { key: "darwin",                section: "root", def: { enabled: false }, help: "Adaptive signal-weighting (off by default). Set { \"enabled\": true } to turn on; signal-weights.js reads windowDays/minSamples/boostFactor/decayFactor/weightFloor." },
];
