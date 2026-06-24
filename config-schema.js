/**
 * Config schema — single source of defaults + help text for the setup wizard.
 *
 * Used by setup.js to write a COMPLETE user-config.json (every key, so no
 * default is hidden) plus a `_help` block explaining each key.
 *
 * IMPORTANT: keep the defaults here in sync with config.js (config.js remains
 * the runtime source of truth). Each entry: { key, def, help }.
 */
export const CONFIG_SCHEMA = [
  // ─── Risk ───────────────────────────────────────────────────────────────
  { key: "maxPositions",          def: 3,        help: "Max concurrent open LP positions." },
  { key: "maxDeployAmount",       def: 50,       help: "Hard ceiling on SOL deployed per position." },

  // ─── Screening ──────────────────────────────────────────────────────────
  { key: "minFeeActiveTvlRatio",  def: 0.05,     help: "Min fee/active-TVL ratio (%), measured over `timeframe`. Scale this with the timeframe." },
  { key: "minTvl",                def: 10000,    help: "Min pool TVL (USD)." },
  { key: "maxTvl",                def: 150000,   help: "Max pool TVL (USD)." },
  { key: "minVolume",             def: 500,      help: "Min pool volume (USD) over `timeframe`. Scale this with the timeframe." },
  { key: "minOrganic",            def: 60,       help: "Min Jupiter organic score (0-100)." },
  { key: "minHolders",            def: 500,      help: "Min base-token holder count." },
  { key: "minMcap",               def: 150000,   help: "Min base-token market cap (USD)." },
  { key: "maxMcap",               def: 10000000, help: "Max base-token market cap (USD)." },
  { key: "minBinStep",            def: 80,       help: "Min DLMM bin step allowed for deploy." },
  { key: "maxBinStep",            def: 125,      help: "Max DLMM bin step allowed for deploy." },
  { key: "timeframe",             def: "5m",     help: "Screening window: 5m|15m|1h|2h|4h|24h. Pool metrics (volume, fee/TVL, volatility) are measured over this window." },
  { key: "category",              def: "trending", help: "Meteora pool-discovery category filter (e.g. trending, top)." },
  { key: "minTokenFeesSol",       def: 30,       help: "Min all-time global fees paid by the token (SOL). Below this = likely bundled/scam. Hard rule." },
  { key: "maxBundlePct",          def: 30,       help: "Max bundle-holding % (OKX). Context only, NOT a hard filter." },
  { key: "maxBotHoldersPct",      def: 30,       help: "Max bot-holder % (Jupiter audit). Hard filter." },
  { key: "maxTop10Pct",           def: 60,       help: "Max top-10 holder concentration %. Hard filter." },
  { key: "blockedLaunchpads",     def: [],       help: "Launchpads to never deploy into, e.g. [\"pump.fun\", \"letsbonk.fun\"]." },
  { key: "allowedLaunchpads",     def: [],       help: "If non-empty, only deploy into these launchpads." },
  { key: "minTokenAgeHours",      def: null,     help: "Min token age in hours (null = no minimum)." },
  { key: "maxTokenAgeHours",      def: null,     help: "Max token age in hours (null = no maximum)." },
  { key: "athFilterPct",          def: null,     help: "Only deploy if price is >= this % below ATH, e.g. -20 (null = off)." },
  { key: "maxPriceVolatility",    def: 50,       help: "Max % price swing during a position (learning metric, auto-evolved)." },
  { key: "maxVolatility",         def: 10,       help: "Max pool volatility at screening time (~0-5 typical, 5+ high). Hard filter + auto-evolved." },

  // ─── Management ─────────────────────────────────────────────────────────
  { key: "minClaimAmount",        def: 5,        help: "Min unclaimed fees (USD) before claiming." },
  { key: "autoSwapAfterClaim",    def: false,    help: "Auto-swap claimed base token back to SOL after a standalone claim." },
  { key: "outOfRangeBinsToClose", def: 10,       help: "If active bin is this many bins ABOVE range, close (pumped far above)." },
  { key: "outOfRangeWaitMinutes", def: 30,       help: "Minutes out-of-range before closing." },
  { key: "oorCooldownTriggerCount", def: 3,      help: "OOR closes within the window before a pool/token goes on cooldown." },
  { key: "oorCooldownHours",      def: 12,       help: "Cooldown duration (hours) after repeated OOR closes." },
  { key: "stopLossPct",           def: -20,      help: "Close if PnL drops to this % (negative)." },
  { key: "minAgeBeforeSL",        def: 15,       help: "Minutes before stop-loss can trigger." },
  { key: "takeProfitFeePct",      def: 5,        help: "Static take-profit when PnL reaches this %." },
  { key: "minFeePerTvl24h",       def: 7,        help: "Min fee/TVL (24h, fixed window) before closing for low yield." },
  { key: "minAgeBeforeYieldCheck", def: 60,      help: "Minutes before the low-yield close rule can trigger." },
  { key: "minSolToOpen",          def: 0.55,     help: "Min wallet SOL before opening a new position." },
  { key: "deployAmountSol",       def: 0.5,      help: "Base/floor SOL per new position." },
  { key: "gasReserve",            def: 0.2,      help: "SOL kept aside for gas." },
  { key: "positionSizePct",       def: 0.35,     help: "Fraction of deployable balance to use (compounds with wallet)." },
  { key: "trailingTakeProfit",    def: true,     help: "Enable trailing take-profit." },
  { key: "trailingTriggerPct",    def: 3,        help: "Activate trailing once PnL reaches this %." },
  { key: "trailingDropPct",       def: 1.5,      help: "Close when PnL drops this % from the confirmed peak." },
  { key: "pnlSanityMaxDiffPct",   def: 5,        help: "Max diff between reported and derived PnL % before ignoring a tick." },
  { key: "solMode",               def: false,    help: "Report positions/PnL/balances in SOL instead of USD." },

  // ─── Strategy ───────────────────────────────────────────────────────────
  { key: "strategy",              def: "bid_ask", help: "Default LP strategy when signals are unclear: bid_ask|spot|curve." },
  { key: "targetDownsidePct",     def: 0.35,     help: "Bin range covers this % price drop below the active bin." },
  { key: "targetUpsidePct",       def: 0.20,     help: "Bin range covers this % price rise above the active bin (spot only)." },

  // ─── Schedule ───────────────────────────────────────────────────────────
  { key: "managementIntervalMin", def: 10,       help: "Management cycle frequency (minutes)." },
  { key: "screeningIntervalMin",  def: 30,       help: "Screening cycle frequency (minutes)." },
  { key: "healthCheckIntervalMin", def: 60,      help: "Portfolio health-check frequency (minutes)." },

  // ─── LLM ────────────────────────────────────────────────────────────────
  { key: "temperature",           def: 0.373,    help: "LLM sampling temperature." },
  { key: "maxTokens",             def: 4096,     help: "Max output tokens per LLM call." },
  { key: "maxSteps",              def: 20,       help: "Max ReAct steps per agent run." },
  { key: "managementModel",       def: "openrouter/healer-alpha", help: "Model for management cycles." },
  { key: "screeningModel",        def: "openrouter/hunter-alpha", help: "Model for screening cycles." },
  { key: "generalModel",          def: "openrouter/healer-alpha", help: "Model for REPL / chat." },

  // ─── Darwin (optional adaptive signal weights) ──────────────────────────
  { key: "darwin",                def: { enabled: false }, help: "Adaptive signal-weighting (off by default). Set { \"enabled\": true } to turn on; signal-weights.js reads windowDays/minSamples/boostFactor/decayFactor/weightFloor." },
];
