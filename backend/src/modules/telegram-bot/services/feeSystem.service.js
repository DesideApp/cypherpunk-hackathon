// src/modules/telegram-bot/feeSystem.js
// Sistema de fees para monetización del bot

import logger from '#config/logger.js';

/**
 * Configuración de fees
 */
const FEE_CONFIG = {
  // Fee base por transacción (en SOL)
  BASE_FEE: 0.001, // 0.001 SOL = ~$0.20
  
  // Fee como porcentaje del monto (0.01 = 1%)
  PERCENTAGE_FEE: 0.01, // 1%
  
  // Fee mínimo (en SOL)
  MIN_FEE: 0.0005, // 0.0005 SOL = ~$0.10
  
  // Fee máximo (en SOL)
  MAX_FEE: 0.01, // 0.01 SOL = ~$2.00
  
  // Wallet donde se envían los fees
  FEE_WALLET: process.env.FEE_WALLET || '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  
  // Tokens soportados para fees
  SUPPORTED_TOKENS: ['SOL', 'USDC', 'USDT']
};

/**
 * Calcula el fee para una transacción
 * @param {Object} params - Parámetros de la transacción
 * @param {string} params.token - Token de la transacción
 * @param {number} params.amount - Monto de la transacción
 * @param {string} params.type - Tipo de transacción (send, request, buy)
 * @returns {Object} - Información del fee
 */
export function calculateFee({ token, amount, type }) {
  try {
    // Validar token soportado
    if (!FEE_CONFIG.SUPPORTED_TOKENS.includes(token.toUpperCase())) {
      throw new Error(`Token no soportado para fees: ${token}`);
    }

    // Calcular fee base
    let feeAmount = FEE_CONFIG.BASE_FEE;
    
    // Añadir fee porcentual si el monto es significativo
    if (amount > 0) {
      const percentageFee = amount * FEE_CONFIG.PERCENTAGE_FEE;
      feeAmount += percentageFee;
    }
    
    // Aplicar límites mínimo y máximo
    feeAmount = Math.max(feeAmount, FEE_CONFIG.MIN_FEE);
    feeAmount = Math.min(feeAmount, FEE_CONFIG.MAX_FEE);
    
    // Redondear a 6 decimales para SOL
    feeAmount = Math.round(feeAmount * 1000000) / 1000000;
    
    const feeInfo = {
      amount: feeAmount,
      token: 'SOL', // Los fees siempre se cobran en SOL
      percentage: FEE_CONFIG.PERCENTAGE_FEE * 100,
      baseFee: FEE_CONFIG.BASE_FEE,
      minFee: FEE_CONFIG.MIN_FEE,
      maxFee: FEE_CONFIG.MAX_FEE,
      feeWallet: FEE_CONFIG.FEE_WALLET,
      type: type || 'transaction'
    };
    
    logger.info('💰 [fee-system] Fee calculated', {
      token,
      amount,
      type,
      feeAmount,
      feeWallet: FEE_CONFIG.FEE_WALLET
    });
    
    return feeInfo;
    
  } catch (error) {
    logger.error('❌ [fee-system] Error calculating fee', {
      token,
      amount,
      type,
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Añade el fee a una acción de transferencia
 * @param {Object} actionResult - Resultado de la acción original
 * @param {Object} feeInfo - Información del fee
 * @returns {Object} - Acción modificada con fee
 */
export function addFeeToAction(actionResult, feeInfo) {
  try {
    const baseUrl = actionResult.actionUrl || actionResult.dialToUrl || null;
    const actionUrlWithFee = baseUrl ? addFeeToActionUrl(baseUrl, feeInfo) : null;

    // Crear una nueva acción que incluya el fee
    const feeAction = {
      ...actionResult,
      fee: feeInfo,
      // Añadir información del fee al memo si existe
      memo: actionResult.memo 
        ? `${actionResult.memo} (Fee: ${feeInfo.amount} SOL)`
        : `Fee: ${feeInfo.amount} SOL`,
      // Modificar la URL para incluir el fee si existe
      actionUrl: actionUrlWithFee || actionResult.actionUrl || actionResult.dialToUrl,
      dialToUrl: actionUrlWithFee || actionResult.dialToUrl || actionResult.actionUrl
    };
    
    logger.info('💸 [fee-system] Fee added to action', {
      originalAction: baseUrl,
      feeAmount: feeInfo.amount,
      feeWallet: feeInfo.feeWallet
    });
    
    return feeAction;
    
  } catch (error) {
    logger.error('❌ [fee-system] Error adding fee to action', {
      actionResult,
      feeInfo,
      error: error.message
    });
    
    throw error;
  }
}

/**
 * Añade parámetros de fee a una URL de acción
 * @param {string} actionUrl - URL original de la acción
 * @param {Object} feeInfo - Información del fee
 * @returns {string} - URL modificada con fee
 */
function addFeeToActionUrl(actionUrl, feeInfo) {
  try {
    if (!actionUrl) {
      logger.warn('⚠️ [fee-system] No action URL provided to append fee parameters');
      return null;
    }

    const url = new URL(actionUrl);
    
    // Añadir parámetros de fee
    url.searchParams.set('feeAmount', feeInfo.amount.toString());
    url.searchParams.set('feeToken', feeInfo.token);
    url.searchParams.set('feeWallet', feeInfo.feeWallet);
    url.searchParams.set('feeType', feeInfo.type);
    
    return url.toString();
    
  } catch (error) {
    logger.error('❌ [fee-system] Error modifying action URL', {
      actionUrl,
      feeInfo,
      error: error.message
    });
    
    // Si hay error, devolver la URL original
    return actionUrl || null;
  }
}

/**
 * Valida si un fee es válido
 * @param {Object} feeInfo - Información del fee a validar
 * @returns {boolean} - True si el fee es válido
 */
export function validateFee(feeInfo) {
  try {
    // Validar estructura
    if (!feeInfo || typeof feeInfo !== 'object') {
      return false;
    }
    
    // Validar campos requeridos
    if (!feeInfo.amount || !feeInfo.token || !feeInfo.feeWallet) {
      return false;
    }
    
    // Validar monto
    if (feeInfo.amount < FEE_CONFIG.MIN_FEE || feeInfo.amount > FEE_CONFIG.MAX_FEE) {
      return false;
    }
    
    // Validar token
    if (feeInfo.token !== 'SOL') {
      return false;
    }
    
    // Validar wallet
    const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!BASE58_RE.test(feeInfo.feeWallet)) {
      return false;
    }
    
    return true;
    
  } catch (error) {
    logger.error('❌ [fee-system] Error validating fee', {
      feeInfo,
      error: error.message
    });
    
    return false;
  }
}

/**
 * Obtiene la configuración actual de fees
 * @returns {Object} - Configuración de fees
 */
export function getFeeConfig() {
  return {
    ...FEE_CONFIG,
    // No exponer la wallet privada en la configuración pública
    feeWallet: '***' // Solo mostrar que está configurada
  };
}

/**
 * Actualiza la configuración de fees
 * @param {Object} newConfig - Nueva configuración
 */
export function updateFeeConfig(newConfig) {
  try {
    // Validar nueva configuración
    if (newConfig.baseFee && (newConfig.baseFee < 0 || newConfig.baseFee > 0.1)) {
      throw new Error('Base fee debe estar entre 0 y 0.1 SOL');
    }
    
    if (newConfig.percentageFee && (newConfig.percentageFee < 0 || newConfig.percentageFee > 0.1)) {
      throw new Error('Percentage fee debe estar entre 0% y 10%');
    }
    
    if (newConfig.minFee && (newConfig.minFee < 0 || newConfig.minFee > 0.01)) {
      throw new Error('Min fee debe estar entre 0 y 0.01 SOL');
    }
    
    if (newConfig.maxFee && (newConfig.maxFee < 0 || newConfig.maxFee > 0.1)) {
      throw new Error('Max fee debe estar entre 0 y 0.1 SOL');
    }
    
    // Actualizar configuración
    Object.assign(FEE_CONFIG, newConfig);
    
    logger.info('⚙️ [fee-system] Fee configuration updated', {
      newConfig: Object.keys(newConfig)
    });
    
    return FEE_CONFIG;
    
  } catch (error) {
    logger.error('❌ [fee-system] Error updating fee config', {
      newConfig,
      error: error.message
    });
    
    throw error;
  }
}

export default {
  calculateFee,
  addFeeToAction,
  validateFee,
  getFeeConfig,
  updateFeeConfig
};




