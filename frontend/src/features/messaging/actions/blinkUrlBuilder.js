import { assertAllowed } from "../config/blinkSecurity.js";
import { ENV, SOLANA } from "@shared/config/env.js";
import {
  normalizeAmount,
  validateAmount,
  isSupportedToken,
} from "@shared/tokens/tokens.js";

const ACTION_TRANSFER_BASE = "https://solana.dial.to/api/actions/transfer";
const DIAL_TO_BASE = "https://dial.to/?action=";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function ensureWalletAddress(address, field = "wallet") {
  const value = String(address || "").trim();
  if (!BASE58_RE.test(value)) {
    throw new Error(`Invalid ${field} address`);
  }
  return value;
}

function buildUrls(actionUrl) {
  const solanaActionUrl = `solana-action:${actionUrl}`;
  const dialToUrl = `${DIAL_TO_BASE}${encodeURIComponent(solanaActionUrl)}`;
  return { actionUrl, solanaActionUrl, dialToUrl };
}

function ensureToken(token) {
  const code = String(token || "").toUpperCase();
  if (!isSupportedToken(code)) {
    throw new Error(`Unsupported token: ${token}`);
  }
  return code;
}

function buildBlinkApiUrl(actionUrl) {
  if (!actionUrl) return null;
  const base = ENV?.DIALECT?.API_BASE_URL || "https://api.dial.to/v1";
  const trimmedBase = String(base || "").replace(/\/+$/, "");
  if (!trimmedBase) return null;
  return `${trimmedBase}/blink?apiUrl=${encodeURIComponent(actionUrl)}`;
}

export function buildTransfer({ token, to, amount, memo }) {
  const tokenCode = ensureToken(token);
  const recipient = ensureWalletAddress(to, "recipient");
  const validation = validateAmount(tokenCode, amount);
  if (!validation.ok) {
    throw new Error(validation.reason || "Invalid amount");
  }
  const normalizedAmount = normalizeAmount(validation.value, tokenCode);
  const url = new URL(ACTION_TRANSFER_BASE);
  url.searchParams.set("toWallet", recipient);
  url.searchParams.set("token", tokenCode);
  url.searchParams.set("amount", normalizedAmount);
  const rawCluster = (ENV?.SOLANA?.CHAIN || SOLANA?.CHAIN || "").trim();
  const normalizedCluster = rawCluster.toLowerCase();
  if (normalizedCluster && normalizedCluster !== "mainnet-beta" && normalizedCluster !== "mainnet") {
    url.searchParams.set("cluster", rawCluster);
  }
  if (memo) url.searchParams.set("memo", memo);
  const actionUrl = url.toString().trim();
  assertAllowed(actionUrl, { feature: "transfer" });
  return {
    token: tokenCode,
    to: recipient,
    amount: normalizedAmount,
    memo: memo || null,
    ...buildUrls(actionUrl),
    blinkApiUrl: buildBlinkApiUrl(actionUrl),
  };
}

export function buildRequest({ token, to, amount, memo }) {
  // Request is the same Action URL but the requester becomes the recipient; the
  // counterparty will complete it.
  return buildTransfer({ token, to, amount, memo });
}

export function isAllowedBlink(url) {
  try {
    assertAllowed(url);
    return true;
  } catch {
    return false;
  }
}

export function asDialToUrl(actionUrl) {
  assertAllowed(actionUrl);
  return buildUrls(actionUrl).dialToUrl;
}
