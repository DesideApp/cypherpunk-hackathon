import fetch from 'node-fetch';
import logger from '#config/logger.js';
import { env } from '#config/env.js';
import { BlinkExecutionError } from '#shared/services/dialectBlinkService.js';
import { getTokenInfo } from '#shared/services/blinkValidationService.js';
import logEvent from '#modules/stats/services/eventLogger.service.js';
import { logActionBuy, logActionBuyFailed } from '#modules/actions/services/actionEvents.service.js';

const INPUT_MINT = 'So11111111111111111111111111111111111111112';
const INPUT_DECIMALS = 9;

const DEFAULT_SLIPPAGE_BPS = Number(process.env.JUPITER_SLIPPAGE_BPS ?? 150);
const MAX_SOL_AMOUNT = Number(process.env.JUPITER_MAX_SOL || 5);
const MIN_SOL_AMOUNT = Number(process.env.JUPITER_MIN_SOL || 0.01);

const QUOTE_URL = env.JUPITER_QUOTE_URL || 'https://quote-api.jup.ag/v6/quote';
const SWAP_URL = env.JUPITER_SWAP_URL || 'https://quote-api.jup.ag/v6/swap';

function normalizeCluster(raw) {
  const value = String(raw || '').trim().toLowerCase();
  if (!value || value === 'mainnet' || value === 'mainnet-beta') return 'mainnet-beta';
  if (value === 'devnet' || value === 'testnet') return value;
  return 'mainnet-beta';
}

function blockchainHeader() {
  const c = normalizeCluster(env.SOLANA_CLUSTER);
  return c === 'devnet' ? 'solana:devnet' : 'solana:mainnet';
}

function applyBlinkHeaders(res) {
  // Do NOT set Access-Control-Allow-Origin here; global CORS middleware handles credentials.
  res.set({
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'x-action-version': '2.4',
    'x-blockchain-ids': blockchainHeader(),
    'Vary': 'Origin',
  });
}

function parseAmount(amount) {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new BlinkExecutionError('Invalid amount', {
      status: 400,
      body: { error: 'INVALID_AMOUNT', amount },
    });
  }
  if (parsed < MIN_SOL_AMOUNT || parsed > MAX_SOL_AMOUNT) {
    throw new BlinkExecutionError('AMOUNT_OUT_OF_RANGE', {
      status: 400,
      body: { error: 'AMOUNT_OUT_OF_RANGE', min: MIN_SOL_AMOUNT, max: MAX_SOL_AMOUNT },
    });
  }
  return parsed;
}

function uiAmountToBaseUnits(amount, decimals) {
  const normalized = String(amount || '').trim();
  if (!/^(\d+)(\.\d+)?$/.test(normalized)) {
    throw new BlinkExecutionError('Invalid amount', {
      status: 400,
      body: { error: 'INVALID_AMOUNT', amount },
    });
  }
  const [whole, fraction = ''] = normalized.split('.');
  const paddedFraction = (fraction + '0'.repeat(decimals)).slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

function baseUnitsToUi(amount, decimals) {
  const divisor = 10n ** BigInt(decimals);
  const whole = amount / divisor;
  const fraction = amount % divisor;
  const fractionStr = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return fractionStr ? `${whole}.${fractionStr}` : whole.toString();
}

async function requestQuote({ inputMint, outputMint, amountLamports, cluster, slippageBps }) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountLamports.toString(),
    slippageBps: String(slippageBps),
    swapMode: 'ExactIn',
    restrictIntermediateTokens: 'true',
    onlyDirectRoutes: 'false',
    dynamicSlippage: 'true',
  });
  const feeBps = Number(env.JUPITER_PLATFORM_FEE_BPS || 0);
  if (feeBps > 0) params.set('platformFeeBps', String(feeBps));
  if (cluster && cluster !== 'mainnet-beta') params.set('cluster', cluster);

  const url = `${QUOTE_URL}?${params.toString()}`;
  logger.info('▶️ [jupiter] quote request', { url });

  const response = await fetch(url, {
    headers: env.JUPITER_API_KEY ? { 'X-API-KEY': env.JUPITER_API_KEY } : undefined,
  });
  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    logger.warn('⚠️ [jupiter] quote failed', { status: response.status, data });
    throw new BlinkExecutionError('JUPITER_QUOTE_FAILED', {
      status: 502,
      body: { error: 'JUPITER_QUOTE_FAILED', status: response.status, data },
    });
  }

  return data;
}

async function requestSwap({ quoteResponse, userPublicKey, cluster }) {
  const body = {
    quoteResponse,
    userPublicKey,
    wrapAndUnwrapSol: true,
    dynamicSlippage: true,
    dynamicComputeUnitLimit: true,
    computeUnitPriceMicroLamports: Number(process.env.JUPITER_PRIORITY_FEE_MICROLAMPORTS || 0) || undefined,
  };

  if (cluster && cluster !== 'mainnet-beta') body.cluster = cluster;

  // Fee via feeAccount (Lite API). If set, Jupiter collects fee into this ATA.
  if (env.JUPITER_FEE_ACCOUNT) body.feeAccount = env.JUPITER_FEE_ACCOUNT;

  const response = await fetch(SWAP_URL, {
    method: 'POST',
    headers: Object.assign(
      { 'Content-Type': 'application/json' },
      env.JUPITER_API_KEY ? { 'X-API-KEY': env.JUPITER_API_KEY } : {}
    ),
    body: JSON.stringify(body),
  });

  const data = await response.json().catch(() => null);

  if (!response.ok || !data) {
    logger.warn('⚠️ [jupiter] swap failed', { status: response.status, data });
    throw new BlinkExecutionError('JUPITER_SWAP_FAILED', {
      status: 502,
      body: { error: 'JUPITER_SWAP_FAILED', status: response.status, data },
    });
  }

  if (!data.swapTransaction) {
    throw new BlinkExecutionError('JUPITER_SWAP_NO_TRANSACTION', {
      status: 502,
      body: { error: 'JUPITER_SWAP_NO_TRANSACTION', data },
    });
  }

  return data;
}

function buildPreview({ token, amount, tokenInfo }) {
  const formattedAmount = Number(amount).toFixed(2).replace(/\.00$/, '');
  return {
    image: `https://deside.assets/blinks/${token.toLowerCase()}.png`,
    title: `Buy ${token}`,
    description: `Swap ${formattedAmount} SOL into ${token}`,
    cta: `Buy ${token}`,
    context: {
      url: 'https://deside.app',
      websiteUrl: 'https://deside.app',
      category: 'Trading',
      provider: {
        name: 'Deside',
        icon: 'https://deside.assets/logo.png',
      },
    },
  };
}

export async function getBuyBlinkMetadata(req, res) {
  try {
    const token = String(req.query.token || '').trim().toUpperCase();
    const amountRaw = req.query.amount ?? '0.1';
    const amount = parseAmount(amountRaw);
    const tokenInfo = await getTokenInfo(token);

    if (!tokenInfo) {
      applyBlinkHeaders(res);
      return res.status(400).json({ error: 'TOKEN_NOT_SUPPORTED', token });
    }

    const protocol = req.protocol || 'https';
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}/api/v1/blinks/buy`;
    const preview = buildPreview({ token, amount, tokenInfo });

    // Quick amounts and custom parameter
    const quick = [0.1, 0.5, 1];
    const actions = quick.map((a) => ({
      type: 'transaction',
      href: `${baseUrl}?token=${token}&amount=${a}`,
      label: `${a} SOL`,
    }));
    actions.push({
      type: 'transaction',
      href: `${baseUrl}?token=${token}&amount={amount}`,
      label: `Buy ${token}`,
      parameters: [
        { name: 'amount', label: 'Enter a SOL amount', type: 'number' },
      ],
    });

    const payload = {
      type: 'action',
      icon: 'https://jup.ag/favicon.ico',
      title: preview.title,
      description: preview.description,
      label: preview.cta,
      context: preview.context,
      preview: Object.assign({}, preview, {
        image: `https://jup.ag/og.png`,
      }),
      links: { actions },
    };

    applyBlinkHeaders(res);
    await safeLog(req.user?.wallet || req.user?.pubkey, 'blink_metadata_hit', {
      token,
      amount,
    });
    return res.status(200).json(payload);
  } catch (error) {
    logger.error('❌ [buy] metadata error', { error: error?.message });
    applyBlinkHeaders(res);
    return res.status(error.status || 500).json({
      error: error.body?.error || error.message || 'BUY_METADATA_FAILED',
      details: error.body,
    });
  }
}

export async function executeBuyBlink(req, res) {
  const token = String(req.query.token || '').trim().toUpperCase();
  const amountRaw = req.query.amount ?? req.body?.data?.amount ?? req.body?.amount;
  const account = String(req.body?.account || '').trim();
  const tokenInfo = await getTokenInfo(token);

  if (!token) {
    applyBlinkHeaders(res);
    return res.status(400).json({ error: 'TOKEN_REQUIRED' });
  }
  if (!tokenInfo) {
    applyBlinkHeaders(res);
    return res.status(400).json({ error: 'TOKEN_NOT_SUPPORTED', token });
  }
  if (!account) {
    applyBlinkHeaders(res);
    return res.status(400).json({ error: 'ACCOUNT_REQUIRED' });
  }
  if (req.user?.wallet && req.user.wallet !== account) {
    applyBlinkHeaders(res);
    return res.status(403).json({ error: 'ACCOUNT_MISMATCH' });
  }

  try {
    const amount = parseAmount(amountRaw);
    const cluster = normalizeCluster(env.SOLANA_CLUSTER);
    const slippage = Number(req.body?.data?.slippageBps) || DEFAULT_SLIPPAGE_BPS;
    const amountLamports = uiAmountToBaseUnits(String(amount), INPUT_DECIMALS);

    const quote = await requestQuote({
      inputMint: INPUT_MINT,
      outputMint: tokenInfo.mint,
      amountLamports,
      cluster,
      slippageBps: slippage,
    });

    const swap = await requestSwap({
      quoteResponse: quote,
      userPublicKey: account,
      cluster,
    });

    const expectedOut = quote?.outAmount ? baseUnitsToUi(BigInt(quote.outAmount), tokenInfo.decimals) : null;

    logger.info('✅ [buy] transaction ready', {
      token,
      account,
      inAmount: amount,
      expectedOut,
    });

    const payload = {
      type: 'transaction',
      transaction: swap.swapTransaction,
      message: `Swap ${amount} SOL for ${token}`,
      lifecycle: {
        executing: { message: 'Opening wallet…' },
        success: { message: expectedOut ? `Received ≈ ${expectedOut} ${token}` : 'Swap completed.' },
        error: { message: 'Swap failed.' },
      },
      info: {
        token,
        amountInSol: amount,
        expectedOut,
        priceImpactPct: quote?.priceImpactPct,
      },
    };
    applyBlinkHeaders(res);
    await safeLog(account, 'blink_execute', {
      token,
      amountInSol: amount,
      expectedOut,
      volume: expectedOut ? Number(expectedOut) : 0,
    });
    return res.status(200).json(payload);
  } catch (error) {
    logger.error('❌ [buy] execution error', { error: error?.message, details: error?.body });
    await safeLog(req.user?.wallet || account, 'blink_execute_failed', {
      token,
      amount: amountRaw,
      error: error?.message,
    });
    if (error instanceof BlinkExecutionError) {
      applyBlinkHeaders(res);
      return res.status(error.status || 500).json({
        error: error.body?.error || error.message,
        details: error.body,
      });
    }
    applyBlinkHeaders(res);
    return res.status(500).json({ error: 'BUY_EXECUTION_FAILED', details: { message: error?.message } });
  }
}

async function safeLog(userId, eventType, data) {
  try {
    if (!userId) return;
    await logEvent(userId, eventType, data);
  } catch (error) {
    logger.warn(`⚠️ [buy] Failed to log ${eventType}`, { error: error.message });
  }
}
