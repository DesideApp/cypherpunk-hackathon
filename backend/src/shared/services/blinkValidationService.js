import { env } from '#config/env.js';
import logger from '#config/logger.js';
import { BlinkExecutionError } from './dialectBlinkService.js';
import { getAllowedTokens, getTokensAsLegacyFormat } from '../../modules/tokens/services/tokenService.js';

// Cache de tokens (se recarga cada minuto)
let ALLOWED_TOKENS_CACHE = {};
let CACHE_TIMESTAMP = 0;
const CACHE_DURATION = 60000; // 1 minuto

/**
 * Carga tokens desde tokens.json con cache
 */
async function loadAllowedTokens() {
  const now = Date.now();
  
  if (ALLOWED_TOKENS_CACHE && Object.keys(ALLOWED_TOKENS_CACHE).length > 0 && (now - CACHE_TIMESTAMP) < CACHE_DURATION) {
    return ALLOWED_TOKENS_CACHE;
  }
  
  try {
    const tokens = await getTokensAsLegacyFormat();
    ALLOWED_TOKENS_CACHE = tokens;
    CACHE_TIMESTAMP = now;
    
    logger.info('[blinkValidation] Tokens loaded from config', { 
      count: Object.keys(tokens).length,
      codes: Object.keys(tokens) 
    });
    
    return tokens;
  } catch (error) {
    logger.error('[blinkValidation] Error loading tokens, using fallback', { error: error.message });
    
    // Fallback a tokens hardcodeados si falla
    return {
      BONK: {
        mint: env.MINT_BONK || 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
        code: 'BONK',
        label: 'Bonk',
        decimals: 5,
        maxAmount: 1000000,
        minAmount: 0.001,
      },
      JUP: {
        mint: env.MINT_JUP || 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
        code: 'JUP',
        label: 'Jupiter',
        decimals: 6,
        maxAmount: 10000,
        minAmount: 0.001,
      },
    };
  }
}

// Mints permitidos para compra (se actualiza dinámicamente)
async function getAllowedBuyMints() {
  const tokens = await loadAllowedTokens();
  return Object.values(tokens)
    .filter(token => token.mint && token.mint.trim() !== '')
    .map(token => token.mint);
}

// Maps de tokens (se actualizan dinámicamente)
async function getTokenByMint(mint) {
  const tokens = await loadAllowedTokens();
  return Object.values(tokens).find(t => t.mint === mint);
}

async function getTokenByCode(code) {
  const tokens = await loadAllowedTokens();
  return tokens[code.toUpperCase()];
}

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const SYMBOL_TO_MINT = {
  SOL: 'So11111111111111111111111111111111111111112',
  WSOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
};

// Mints permitidos para transfer/request (todos los tokens soportados)
const ALLOWED_TRANSFER_MINTS = [
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB', // USDT
  'So11111111111111111111111111111111111111112',    // WSOL
];

/**
 * Valida que un mint esté permitido para operaciones de compra
 */
export async function validateBuyMint(mint) {
  if (!mint || typeof mint !== 'string') {
    throw new BlinkExecutionError('Invalid mint provided', {
      status: 400,
      body: { error: 'INVALID_MINT' },
    });
  }

  const allowedMints = await getAllowedBuyMints();
  
  if (!allowedMints.includes(mint)) {
    logger.warn('🚫 [blink] buy mint not allowed', { mint, allowedMints });
    throw new BlinkExecutionError('Mint not allowed for buy operations', {
      status: 403,
      body: { 
        error: 'MINT_NOT_ALLOWED_FOR_BUY',
        mint,
        allowedMints 
      },
    });
  }

  return true;
}

/**
 * Valida que un mint esté permitido para operaciones de transfer/request
 */
export async function validateTransferMint(mintOrSymbol) {
  if (!mintOrSymbol || typeof mintOrSymbol !== 'string') {
    throw new BlinkExecutionError('Invalid mint provided', {
      status: 400,
      body: { error: 'INVALID_MINT' },
    });
  }

  const candidateRaw = mintOrSymbol.trim();
  const upper = candidateRaw.toUpperCase();

  let resolvedMint = candidateRaw;

  if (!BASE58_RE.test(candidateRaw)) {
    // Intentar resolver desde mapa estático
    resolvedMint = SYMBOL_TO_MINT[upper];
    
    // Si no está, intentar desde tokens dinámicos
    if (!resolvedMint) {
      const token = await getTokenByCode(upper);
      resolvedMint = token?.mint;
    }
  }

  if (!resolvedMint) {
    logger.warn('🚫 [blink] transfer mint resolve failed', { input: mintOrSymbol });
    throw new BlinkExecutionError('Mint not allowed for transfer operations', {
      status: 403,
      body: {
        error: 'MINT_NOT_ALLOWED_FOR_TRANSFER',
        mint: mintOrSymbol,
      },
    });
  }

  const allowedMints = await getAllowedBuyMints();
  const allAllowed = [...ALLOWED_TRANSFER_MINTS, ...allowedMints];
  
  if (!allAllowed.includes(resolvedMint)) {
    logger.warn('🚫 [blink] transfer mint not allowed', { mint: resolvedMint, input: mintOrSymbol });
    throw new BlinkExecutionError('Mint not allowed for transfer operations', {
      status: 403,
      body: {
        error: 'MINT_NOT_ALLOWED_FOR_TRANSFER',
        mint: resolvedMint,
        input: mintOrSymbol,
      },
    });
  }

  return true;
}

/**
 * Valida el monto para un token específico
 */
export async function validateTokenAmount(tokenCode, amount) {
  const rawCode = typeof tokenCode === 'string' ? tokenCode.trim() : '';
  const upper = rawCode.toUpperCase();
  
  const token = await getTokenByCode(upper) || await getTokenByMint(rawCode);

  const numAmount = parseFloat(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    throw new BlinkExecutionError('Invalid amount', {
      status: 400,
      body: { error: 'INVALID_AMOUNT', amount },
    });
  }

  if (!token) {
    // Token fuera de nuestra lista de límites explícitos
    return true;
  }

  if (numAmount < token.minAmount) {
    throw new BlinkExecutionError('Amount too small', {
      status: 400,
      body: { 
        error: 'AMOUNT_TOO_SMALL', 
        amount: numAmount, 
        minAmount: token.minAmount,
        tokenCode 
      },
    });
  }

  if (numAmount > token.maxAmount) {
    throw new BlinkExecutionError('Amount too large', {
      status: 400,
      body: { 
        error: 'AMOUNT_TOO_LARGE', 
        amount: numAmount, 
        maxAmount: token.maxAmount,
        tokenCode 
      },
    });
  }

  return true;
}

/**
 * Extrae parámetros de una URL de acción para validación
 */
export function parseActionUrlParams(actionUrl) {
  try {
    const url = new URL(actionUrl);
    const params = Object.fromEntries(url.searchParams.entries());
    
    return {
      pathname: url.pathname,
      params,
      isBuyAction: url.pathname.includes('/swap') || url.pathname.includes('/buy'),
      isTransferAction: url.pathname.includes('/transfer'),
    };
  } catch (error) {
    throw new BlinkExecutionError('Invalid action URL format', {
      status: 400,
      body: { error: 'INVALID_ACTION_URL_FORMAT' },
      url: actionUrl,
    });
  }
}

/**
 * Valida una URL de acción de blink basada en sus parámetros
 */
export async function validateBlinkAction(actionUrl) {
  const { pathname, params, isBuyAction, isTransferAction } = parseActionUrlParams(actionUrl);

  let tokenCodeForAmount = params.token || null;

  if (isBuyAction) {
    const outputMint = params.outputMint || params.outputMintAddress || params.toMint || params.targetMint;
    if (!outputMint) {
      throw new BlinkExecutionError('Output mint required for buy action', {
        status: 400,
        body: { error: 'OUTPUT_MINT_REQUIRED' },
      });
    }

    await validateBuyMint(outputMint);
    const tokenInfo = await getTokenByMint(outputMint);
    if (!tokenInfo) {
      throw new BlinkExecutionError('Token not supported', {
        status: 400,
        body: { error: 'TOKEN_NOT_SUPPORTED', mint: outputMint },
      });
    }

    tokenCodeForAmount = params.token || tokenInfo.code;
  } else if (isTransferAction) {
    const tokenMint = params.token || params.mint;
    if (tokenMint) {
      await validateTransferMint(tokenMint);
    }
  }

  const amount = params.amount || params.uiAmount;
  if (amount && tokenCodeForAmount) {
    await validateTokenAmount(tokenCodeForAmount, amount);
  } else if (amount && !tokenCodeForAmount && isBuyAction) {
    throw new BlinkExecutionError('Token not supported', {
      status: 400,
      body: { error: 'TOKEN_NOT_SUPPORTED', tokenCode: params.token || 'UNKNOWN' },
    });
  }

  logger.info('✅ [blink] action validation passed', {
    actionUrl,
    pathname,
    isBuyAction,
    isTransferAction,
    params: Object.keys(params),
  });

  return true;
}

/**
 * Obtiene la configuración de tokens permitidos
 */
export async function getAllowedTokensForExport() {
  const tokens = await getAllowedTokens();
  return tokens.map(({ mint, code, label, decimals, maxAmount, minAmount }) => ({
    mint,
    code,
    label,
    decimals,
    maxAmount,
    minAmount,
  }));
}

/**
 * Obtiene información de un token específico
 */
export async function getTokenInfo(tokenCode) {
  const token = await getTokenByCode(tokenCode);
  
  if (!token || !token.mint || token.mint.trim() === '') {
    return null;
  }
  
  return {
    mint: token.mint,
    code: token.code,
    label: token.label,
    decimals: token.decimals,
    maxAmount: token.maxAmount,
    minAmount: token.minAmount,
  };
}
