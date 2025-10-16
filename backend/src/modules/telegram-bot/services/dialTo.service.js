// src/modules/telegram-bot/services/dialTo.service.js
// Utilidades para construir enlaces de acciones Blink en dial.to

import { env } from '#config/env.js';

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const SUPPORTED_TOKENS = ['SOL', 'USDC', 'USDT'];
const ACTION_TRANSFER_BASE = 'https://solana.dial.to/api/actions/transfer';
const DIAL_TO_ACTION_BASE = 'https://dial.to/?action=';
const DIAL_TO_TRANSFER_BASE = 'https://dial.to/transfer';
const DIAL_TO_REQUEST_BASE = 'https://dial.to/request';
const DIAL_TO_BUY_BASE = 'https://dial.to/buy';

function ensureToken(token) {
  const code = String(token || '').trim().toUpperCase();
  if (!SUPPORTED_TOKENS.includes(code)) {
    throw new Error(`Unsupported token: ${token}`);
  }
  return code;
}

function ensureWalletAddress(address, field = 'wallet') {
  const value = String(address || '').trim();
  if (!BASE58_RE.test(value)) {
    throw new Error(`Invalid ${field} address`);
  }
  return value;
}

function normalizeAmount(rawAmount) {
  const num = Number(rawAmount);
  if (!Number.isFinite(num) || num <= 0) {
    throw new Error('Invalid amount');
  }
  // Mantener hasta 9 decimales, evitando notación científica
  return num.toLocaleString('en-US', {
    useGrouping: false,
    maximumFractionDigits: 9,
  });
}

function buildBlinkApiUrl(actionUrl) {
  const base = String(env.DIALECT_API_BASE_URL || 'https://api.dial.to/v1').trim();
  const normalizedBase = base.replace(/\/+$/, '');
  if (!normalizedBase) return null;
  return `${normalizedBase}/blink?apiUrl=${encodeURIComponent(actionUrl)}`;
}

function buildCommonResponse({ actionUrl, token, to, amount, memo, shareBase }) {
  const solanaActionUrl = `solana-action:${actionUrl}`;
  const dialToUrl = `${DIAL_TO_ACTION_BASE}${encodeURIComponent(solanaActionUrl)}`;
  const shareUrl = new URL(shareBase);
  shareUrl.searchParams.set('token', token);
  shareUrl.searchParams.set('to', to);
  shareUrl.searchParams.set('amount', amount);
  if (memo) shareUrl.searchParams.set('memo', memo);
  applyCluster(shareUrl.searchParams);

  return {
    token,
    to,
    amount,
    memo: memo || null,
    actionUrl,
    solanaActionUrl,
    dialToUrl: shareUrl.toString(),
    blinkShareUrl: dialToUrl,
    blinkApiUrl: buildBlinkApiUrl(actionUrl),
  };
}

function applyCluster(searchParams) {
  const rawCluster = String(env.SOLANA_CLUSTER || '').trim();
  const lower = rawCluster.toLowerCase();
  if (!rawCluster) return;

  const isMainnet = lower === 'mainnet' || lower === 'mainnet-beta';
  if (!isMainnet) {
    searchParams.set('cluster', rawCluster);
  }
}

export function buildTransferBlink({ token, to, amount, memo }) {
  const normalizedToken = ensureToken(token);
  const recipient = ensureWalletAddress(to, 'recipient');
  const normalizedAmount = normalizeAmount(amount);

  const url = new URL(ACTION_TRANSFER_BASE);
  url.searchParams.set('toWallet', recipient);
  url.searchParams.set('token', normalizedToken);
  url.searchParams.set('amount', normalizedAmount);
  if (memo) url.searchParams.set('memo', memo);
  applyCluster(url.searchParams);

  return buildCommonResponse({
    actionUrl: url.toString(),
    token: normalizedToken,
    to: recipient,
    amount: normalizedAmount,
    memo,
    shareBase: DIAL_TO_TRANSFER_BASE,
  });
}

export function buildRequestBlink({ token, to, amount, memo }) {
  const normalizedToken = ensureToken(token);
  const recipient = ensureWalletAddress(to, 'recipient');
  const normalizedAmount = normalizeAmount(amount);

  const url = new URL(ACTION_TRANSFER_BASE);
  url.searchParams.set('toWallet', recipient);
  url.searchParams.set('token', normalizedToken);
  url.searchParams.set('amount', normalizedAmount);
  if (memo) url.searchParams.set('memo', memo);
  applyCluster(url.searchParams);

  return buildCommonResponse({
    actionUrl: url.toString(),
    token: normalizedToken,
    to: recipient,
    amount: normalizedAmount,
    memo,
    shareBase: DIAL_TO_REQUEST_BASE,
  });
}

export function buildBuyBlink({ token, amount }) {
  const normalizedToken = ensureToken(token);
  const normalizedAmount = normalizeAmount(amount);

  const blinkBase = env.TELEGRAM_BUY_BLINK_BASE_URL;
  if (!blinkBase) {
    throw new Error('Configura TELEGRAM_BUY_BLINK_BASE_URL para habilitar compras.');
  }

  const actionUrl = new URL(blinkBase);
  actionUrl.searchParams.set('token', normalizedToken);
  actionUrl.searchParams.set('amount', normalizedAmount);
  applyCluster(actionUrl.searchParams);

  return buildCommonResponse({
    actionUrl: actionUrl.toString(),
    token: normalizedToken,
    to: normalizedToken,
    amount: normalizedAmount,
    memo: null,
    shareBase: env.TELEGRAM_BUY_SHARE_BASE_URL || DIAL_TO_BUY_BASE,
  });
}

export default {
  buildTransferBlink,
  buildRequestBlink,
  buildBuyBlink,
};
