import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "./logger.js";
import { CONFIG_SCHEMA } from "./config-schema.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const USER_CONFIG_PATH = path.join(__dirname, "user-config.json");

const u = fs.existsSync(USER_CONFIG_PATH)
  ? JSON.parse(fs.readFileSync(USER_CONFIG_PATH, "utf8"))
  : {};

// Apply wallet/RPC/LLM from user-config if not already in env
if (u.rpcUrl)    process.env.RPC_URL            ||= u.rpcUrl;
if (u.walletKey) process.env.WALLET_PRIVATE_KEY ||= u.walletKey;
if (u.llmModel)  process.env.LLM_MODEL          ||= u.llmModel;
if (u.llmBaseUrl) process.env.LLM_BASE_URL      ||= u.llmBaseUrl;
if (u.llmApiKey)  process.env.LLM_API_KEY       ||= u.llmApiKey;
if (u.dryRun !== undefined) process.env.DRY_RUN ||= String(u.dryRun);

// ─── Build the nested config object directly from config-schema.js ──────────
// config-schema.js is the single source of defaults; config.js applies the user
// overrides (user-config.json) and a few special fallbacks the flat schema can't
// express. Clone object/array defaults so config never shares the schema's refs.
const DEF = Object.fromEntries(CONFIG_SCHEMA.map((s) => [s.key, s.def]));
const cloneDef = (d) => (d && typeof d === "object" ? structuredClone(d) : d);

export const config = {
  risk: {},
  screening: {},
  management: {},
  strategy: {},
  schedule: {},
  llm: {},

  // ─── Common Token Mints (not user-configurable) ────────────────────────
  tokens: {
    SOL:  "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  },
};

for (const { key, section, def } of CONFIG_SCHEMA) {
  const value = u[key] ?? cloneDef(def);
  if (section === "root") config[key] = value;
  else config[section][key] = value;
}

// Special fallbacks the flat schema can't express:
//  - stopLossPct keeps the legacy `emergencyPriceDropPct` alias
//  - per-role models fall back to env LLM_MODEL before the schema default
config.management.stopLossPct = u.stopLossPct ?? u.emergencyPriceDropPct ?? DEF.stopLossPct;
config.llm.managementModel = u.managementModel ?? process.env.LLM_MODEL ?? DEF.managementModel;
config.llm.screeningModel  = u.screeningModel  ?? process.env.LLM_MODEL ?? DEF.screeningModel;
config.llm.generalModel    = u.generalModel    ?? process.env.LLM_MODEL ?? DEF.generalModel;

/**
 * Deploy amount per position — FIXED at `deployAmountSol`.
 * No wallet-scaling / compounding: positionSizePct and maxDeployAmount are not used.
 * `walletSol` is accepted for call-site compatibility but ignored.
 */
export function computeDeployAmount(walletSol) {
  return parseFloat(Number(config.management.deployAmountSol ?? 0.5).toFixed(2));
}

/**
 * Reload user-config.json and apply updated screening thresholds to the
 * in-memory config object. Called after threshold evolution so the next
 * agent cycle uses the evolved values without a restart. Iterates every
 * screening-section key in the schema (no hand-maintained list).
 */
export function reloadScreeningThresholds() {
  if (!fs.existsSync(USER_CONFIG_PATH)) return;
  try {
    const fresh = JSON.parse(fs.readFileSync(USER_CONFIG_PATH, "utf8"));
    const s = config.screening;
    for (const { key, section } of CONFIG_SCHEMA) {
      if (section === "screening" && fresh[key] !== undefined) s[key] = fresh[key];
    }
  } catch (err) {
    log("config_error", `Failed to reload screening thresholds: ${err.message}`);
  }
}
