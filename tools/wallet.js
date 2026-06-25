import {
  Connection,
  PublicKey,
  LAMPORTS_PER_SOL,
  VersionedTransaction,
  Keypair,
} from "@solana/web3.js";
import bs58 from "bs58";
import { log } from "../logger.js";
import { config } from "../config.js";

let _connection = null;
let _wallet = null;

function getConnection() {
  if (!_connection) _connection = new Connection(process.env.RPC_URL, "confirmed");
  return _connection;
}

function getWallet() {
  if (!_wallet) {
    if (!process.env.WALLET_PRIVATE_KEY) throw new Error("WALLET_PRIVATE_KEY not set");
    _wallet = Keypair.fromSecretKey(bs58.decode(process.env.WALLET_PRIVATE_KEY));
  }
  return _wallet;
}

const JUPITER_PRICE_API = "https://api.jup.ag/price/v3";
const JUPITER_ULTRA_API = "https://api.jup.ag/ultra/v1";
const JUPITER_QUOTE_API = "https://api.jup.ag/swap/v1";
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || "";

/**
 * Get current wallet balances: SOL, USDC, and all SPL tokens using Helius Wallet API.
 * Returns USD-denominated values provided by Helius.
 */
export async function getWalletBalances() {
  let walletAddress;
  try {
    walletAddress = getWallet().publicKey.toString();
  } catch {
    return { wallet: null, sol: 0, sol_price: 0, sol_usd: 0, usdc: 0, tokens: [], total_usd: 0, error: "Wallet not configured" };
  }

  const HELIUS_KEY = process.env.HELIUS_API_KEY;
  if (!HELIUS_KEY) {
    log("wallet_error", "HELIUS_API_KEY not set in .env");
    return { wallet: walletAddress, sol: 0, sol_price: 0, sol_usd: 0, usdc: 0, tokens: [], total_usd: 0, error: "Helius API key missing" };
  }

  try {
    const url = `https://api.helius.xyz/v1/wallet/${walletAddress}/balances?api-key=${HELIUS_KEY}`;
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`Helius API error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const balances = data.balances || [];

    // ─── Find SOL and USDC ────────────────────────────────────
    const solEntry = balances.find(b => b.mint === config.tokens.SOL || b.symbol === "SOL");
    const usdcEntry = balances.find(b => b.mint === config.tokens.USDC || b.symbol === "USDC");

    const solBalance = solEntry?.balance || 0;
    const solPrice = solEntry?.pricePerToken || 0;
    const solUsd = solEntry?.usdValue || 0;
    const usdcBalance = usdcEntry?.balance || 0;

    // ─── Map all tokens ───────────────────────────────────────
    const enrichedTokens = balances.map(b => ({
      mint: b.mint,
      symbol: b.symbol || b.mint.slice(0, 8),
      balance: b.balance,
      usd: b.usdValue ? Math.round(b.usdValue * 100) / 100 : null,
    }));

    return {
      wallet: walletAddress,
      sol: Math.round(solBalance * 1e6) / 1e6,
      sol_price: Math.round(solPrice * 100) / 100,
      sol_usd: Math.round(solUsd * 100) / 100,
      usdc: Math.round(usdcBalance * 100) / 100,
      tokens: enrichedTokens,
      total_usd: Math.round((data.totalUsdValue || 0) * 100) / 100,
    };
  } catch (error) {
    log("wallet_error", error.message);
    return {
      wallet: walletAddress,
      sol: 0,
      sol_price: 0,
      sol_usd: 0,
      usdc: 0,
      tokens: [],
      total_usd: 0,
      error: error.message,
    };
  }
}

/**
 * Swap tokens via Jupiter Ultra API (order → sign → execute).
 */
const SOL_MINT = "So11111111111111111111111111111111111111112";

// Normalize any SOL-like address to the correct wrapped SOL mint
export function normalizeMint(mint) {
  if (!mint) return mint;
  const SOL_MINT = "So11111111111111111111111111111111111111112";
  if (
    mint === "SOL" || 
    mint === "native" || 
    /^So1+$/.test(mint) || 
    (mint.length >= 32 && mint.length <= 44 && mint.startsWith("So1") && mint !== SOL_MINT)
  ) {
    return SOL_MINT;
  }
  return mint;
}

// Convert a raw atomic amount to a human-readable decimal value (display-friendly).
function toDecimal(raw, decimals) {
  if (raw == null) return null;
  const n = Number(raw) / Math.pow(10, decimals);
  return Number.isFinite(n) ? Number(n.toFixed(6)) : null;
}

// Resolve a mint's decimals (SOL = 9 without an RPC call).
async function getMintDecimals(connection, mint) {
  if (!mint || mint === config.tokens.SOL) return 9;
  try {
    const info = await connection.getParsedAccountInfo(new PublicKey(mint));
    return info.value?.data?.parsed?.info?.decimals ?? 9;
  } catch {
    return 9;
  }
}

export async function swapToken({
  input_mint,
  output_mint,
  amount,
}) {
  input_mint  = normalizeMint(input_mint);
  output_mint = normalizeMint(output_mint);

  if (process.env.DRY_RUN === "true") {
    return {
      dry_run: true,
      would_swap: { input_mint, output_mint, amount },
      message: "DRY RUN — no transaction sent",
    };
  }

  try {
    log("swap", `${amount} of ${input_mint} → ${output_mint}`);
    const wallet = getWallet();
    const connection = getConnection();

    // ─── Convert to smallest unit ──────────────────────────────
    const decimals = await getMintDecimals(connection, input_mint);
    const outputDecimals = await getMintDecimals(connection, output_mint);
    const amountStr = Math.floor(amount * Math.pow(10, decimals)).toString();

    // ─── Get Ultra order (unsigned tx + requestId) ─────────────
    const orderUrl =
      `${JUPITER_ULTRA_API}/order` +
      `?inputMint=${input_mint}` +
      `&outputMint=${output_mint}` +
      `&amount=${amountStr}` +
      `&taker=${wallet.publicKey.toString()}`;

    const orderRes = await fetch(orderUrl, {
      headers: { "x-api-key": JUPITER_API_KEY },
    });
    if (!orderRes.ok) {
      const body = await orderRes.text();
      if (orderRes.status === 500) {
        log("swap", `Ultra failed for ${input_mint}, falling back to regular swap API`);
        return await swapViaQuoteApi({ wallet, connection, input_mint, output_mint, amountStr, inputDecimals: decimals, outputDecimals });
      }
      throw new Error(`Ultra order failed: ${orderRes.status} ${body}`);
    }

    const order = await orderRes.json();
    if (order.errorCode || order.errorMessage) {
      log("swap", `Ultra error for ${input_mint}, falling back to regular swap API`);
      return await swapViaQuoteApi({ wallet, connection, input_mint, output_mint, amountStr });
    }

    const { transaction: unsignedTx, requestId } = order;

    // ─── Deserialize and sign ─────────────────────────────────
    const tx = VersionedTransaction.deserialize(Buffer.from(unsignedTx, "base64"));
    tx.sign([wallet]);
    const signedTx = Buffer.from(tx.serialize()).toString("base64");

    // ─── Execute ───────────────────────────────────────────────
    const execRes = await fetch(`${JUPITER_ULTRA_API}/execute`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": JUPITER_API_KEY,
      },
      body: JSON.stringify({ signedTransaction: signedTx, requestId }),
    });
    if (!execRes.ok) {
      throw new Error(`Ultra execute failed: ${execRes.status} ${await execRes.text()}`);
    }

    const result = await execRes.json();
    if (result.status === "Failed") {
      throw new Error(`Swap failed on-chain: code=${result.code}`);
    }

    log("swap", `SUCCESS tx: ${result.signature}`);

    return {
      success: true,
      tx: result.signature,
      input_mint,
      output_mint,
      amount_in: toDecimal(result.inputAmountResult, decimals),
      amount_out: toDecimal(result.outputAmountResult, outputDecimals),
    };
  } catch (error) {
    log("swap_error", error.message);
    return { success: false, error: error.message };
  }
}

async function swapViaQuoteApi({ wallet, connection, input_mint, output_mint, amountStr, inputDecimals = 9, outputDecimals = 9 }) {
  // ─── Get quote ─────────────────────────────────────────────
  const quoteRes = await fetch(
    `${JUPITER_QUOTE_API}/quote?inputMint=${input_mint}&outputMint=${output_mint}&amount=${amountStr}&slippageBps=300`,
    { headers: { "x-api-key": JUPITER_API_KEY } }
  );
  if (!quoteRes.ok) throw new Error(`Quote failed: ${quoteRes.status} ${await quoteRes.text()}`);
  const quote = await quoteRes.json();
  if (quote.error) throw new Error(`Quote error: ${quote.error}`);

  // ─── Get swap tx ───────────────────────────────────────────
  const swapRes = await fetch(`${JUPITER_QUOTE_API}/swap`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": JUPITER_API_KEY },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: wallet.publicKey.toString(),
      wrapAndUnwrapSol: true,
    }),
  });
  if (!swapRes.ok) throw new Error(`Swap tx failed: ${swapRes.status} ${await swapRes.text()}`);
  const { swapTransaction } = await swapRes.json();

  // ─── Sign and send ─────────────────────────────────────────
  const tx = VersionedTransaction.deserialize(Buffer.from(swapTransaction, "base64"));
  tx.sign([wallet]);
  const txHash = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
  await connection.confirmTransaction(txHash, "confirmed");

  log("swap", `SUCCESS (fallback) tx: ${txHash}`);
  return {
    success: true,
    tx: txHash,
    input_mint,
    output_mint,
    amount_in: toDecimal(quote.inAmount, inputDecimals),
    amount_out: toDecimal(quote.outAmount, outputDecimals),
  };
}

/**
 * Swap a base token's full wallet balance back to SOL.
 * Shared by every close path (LLM/cron close, trailing TP, stop loss, manual
 * /close) and standalone claims, so the base token never gets stranded.
 * Skips dust (< minUsd) and SOL itself. swapToken() returns {success:false}
 * instead of throwing, so we surface that as `failed` for the caller/LLM.
 *
 * @returns {{swapped:boolean, failed?:boolean, error?:string, symbol?:string, amountOut?:number, note?:string, reason?:string}}
 */
export async function autoSwapToSol(baseMint, { minUsd = 0.10, token = null } = {}) {
  if (!baseMint) return { swapped: false, reason: "no base mint" };
  const mint = normalizeMint(baseMint);
  if (mint === config.tokens.SOL) return { swapped: false, reason: "already SOL" };
  try {
    if (!token) {
      const balances = await getWalletBalances();
      token = balances.tokens?.find((t) => t.mint === mint);
    }
    if (!token || !(token.usd >= minUsd)) return { swapped: false, reason: "dust or no balance" };
    const sym = token.symbol || mint.slice(0, 8);
    log("swap", `Auto-swapping ${sym} ($${token.usd.toFixed(2)}) back to SOL`);
    const res = await swapToken({ input_mint: mint, output_mint: "SOL", amount: token.balance });
    if (res?.success || res?.dry_run) {
      return {
        swapped: true,
        symbol: sym,
        amountOut: res.amount_out,
        note: `Base token already auto-swapped back to SOL (${sym} → SOL). Do NOT call swap_token again.`,
      };
    }
    log("swap_error", `Auto-swap of ${sym} did not succeed: ${res?.error || "unknown"} — token left in wallet`);
    return {
      swapped: false,
      failed: true,
      error: res?.error || "unknown",
      symbol: sym,
      note: `Auto-swap of ${sym} to SOL FAILED (${res?.error || "unknown"}). It is STILL in the wallet — call swap_token to convert it to SOL.`,
    };
  } catch (e) {
    log("swap_error", `Auto-swap failed: ${e.message}`);
    return { swapped: false, failed: true, error: e.message };
  }
}

// Never sweep these — SOL itself and the common quote/stable tokens.
const SWEEP_EXCLUDE = new Set([config.tokens.SOL, config.tokens.USDC, config.tokens.USDT]);

/**
 * Safety net: sweep "stranded" non-SOL tokens in the wallet back to SOL.
 * Catches tokens left behind when a close errors AFTER the on-chain tx landed
 * (RPC flakiness) or any other partial failure — regardless of how it happened.
 *
 * Only free wallet tokens are visible here; tokens still deployed in an open
 * position are locked in the position, so a successful re-seed is never swept.
 * Excludes SOL/stables, dust (< minUsd), and any mint in `keepMints` (the base
 * tokens of currently-open positions).
 *
 * @returns {{ swept: Array, failed: Array, candidates: number, error?: string }}
 */
export async function sweepStrandedTokens({ keepMints = [], minUsd = 0.10 } = {}) {
  const keep = new Set(SWEEP_EXCLUDE);
  for (const m of keepMints) { if (m) keep.add(normalizeMint(m)); }

  const balances = await getWalletBalances();
  if (balances.error) return { swept: [], failed: [], candidates: 0, error: balances.error };

  const candidates = (balances.tokens || []).filter(
    (t) => t.mint && !keep.has(t.mint) && typeof t.usd === "number" && t.usd >= minUsd
  );

  const swept = [], failed = [];
  for (const t of candidates) {
    const sym = t.symbol || t.mint.slice(0, 8);
    log("sweep", `Sweeping stranded ${sym} ($${t.usd.toFixed(2)}) → SOL`);
    const res = await autoSwapToSol(t.mint, { minUsd, token: t });
    if (res.swapped) swept.push({ mint: t.mint, symbol: sym, usd: t.usd, amountOut: res.amountOut });
    else failed.push({ mint: t.mint, symbol: sym, usd: t.usd, error: res.error || res.reason });
    await new Promise((r) => setTimeout(r, 400)); // pace swaps to avoid rate limits
  }
  if (swept.length || failed.length) {
    log("sweep", `Sweep done: ${swept.length} swept, ${failed.length} failed of ${candidates.length} candidate(s)`);
  }
  return { swept, failed, candidates: candidates.length };
}
