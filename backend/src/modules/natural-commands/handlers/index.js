// src/modules/natural-commands/handlers/index.js
// Handlers para ejecutar acciones basadas en comandos naturales

import logger from '#config/logger.js';
// Nota: buildTransfer y buildRequest están en el frontend
// Por ahora usaremos URLs directas, en el futuro se puede crear un servicio compartido
import { executeBuyBlink } from '#modules/blinks/controllers/buyBlink.controller.js';

/**
 * Handler para crear acción de envío
 * @param {Object} params - Parámetros del comando
 * @param {string} userId - ID del usuario
 * @returns {Object} - Resultado de la acción
 */
export async function createSendAction(params, userId) {
  try {
    const { amount, token, recipient, memo } = params;
    
    // Validar parámetros
    if (!amount || !token) {
      throw new Error('Amount and token are required for send action');
    }
    
    // Si no hay destinatario, no podemos crear la acción
    if (!recipient) {
      throw new Error('Recipient is required for send action');
    }
    
    // Construir URL de acción de transferencia (usando Dialect)
    const baseUrl = 'https://solana.dial.to/api/actions/transfer';
    const url = new URL(baseUrl);
    url.searchParams.set('toWallet', recipient);
    url.searchParams.set('token', token.toUpperCase());
    url.searchParams.set('amount', parseFloat(amount).toString());
    if (memo) url.searchParams.set('memo', memo);
    
    const actionUrl = url.toString();
    const dialToUrl = `https://dial.to/?blink=${encodeURIComponent(actionUrl)}`;
    
    const action = {
      actionUrl,
      dialToUrl,
      token: token.toUpperCase(),
      to: recipient,
      amount: parseFloat(amount).toString(),
      memo: memo || null
    };
    
    logger.info('✅ [natural-commands] Send action created', {
      userId,
      token,
      amount,
      recipient,
      actionUrl: action.actionUrl
    });
    
    return {
      success: true,
      action,
      type: 'send',
      message: `Send ${amount} ${token} to ${recipient}`,
      blinkUrl: action.dialToUrl
    };
    
  } catch (error) {
    logger.error('❌ [natural-commands] Send action failed', {
      userId,
      params,
      error: error.message
    });
    
    throw new Error(`Failed to create send action: ${error.message}`);
  }
}

/**
 * Handler para crear acción de solicitud
 * @param {Object} params - Parámetros del comando
 * @param {string} userId - ID del usuario
 * @returns {Object} - Resultado de la acción
 */
export async function createRequestAction(params, userId) {
  try {
    const { amount, token, memo } = params;
    
    // Validar parámetros
    if (!amount || !token) {
      throw new Error('Amount and token are required for request action');
    }
    
    // Para request, el destinatario es el propio usuario (quien solicita)
    // Esto se manejará en el frontend con el wallet del usuario
    
    // Construir URL de acción de solicitud (usando Dialect)
    const baseUrl = 'https://solana.dial.to/api/actions/transfer';
    const url = new URL(baseUrl);
    url.searchParams.set('toWallet', userId); // Se reemplazará con el wallet real en el frontend
    url.searchParams.set('token', token.toUpperCase());
    url.searchParams.set('amount', parseFloat(amount).toString());
    if (memo) url.searchParams.set('memo', memo);
    
    const actionUrl = url.toString();
    const dialToUrl = `https://dial.to/?blink=${encodeURIComponent(actionUrl)}`;
    
    const action = {
      actionUrl,
      dialToUrl,
      token: token.toUpperCase(),
      to: userId,
      amount: parseFloat(amount).toString(),
      memo: memo || null
    };
    
    logger.info('✅ [natural-commands] Request action created', {
      userId,
      token,
      amount,
      actionUrl: action.actionUrl
    });
    
    return {
      success: true,
      action,
      type: 'request',
      message: `Request ${amount} ${token}`,
      blinkUrl: action.dialToUrl
    };
    
  } catch (error) {
    logger.error('❌ [natural-commands] Request action failed', {
      userId,
      params,
      error: error.message
    });
    
    throw new Error(`Failed to create request action: ${error.message}`);
  }
}

/**
 * Handler para crear acción de compra
 * @param {Object} params - Parámetros del comando
 * @param {string} userId - ID del usuario
 * @returns {Object} - Resultado de la acción
 */
export async function createBuyAction(params, userId) {
  try {
    const { amount, token } = params;
    
    // Validar parámetros
    if (!amount || !token) {
      throw new Error('Amount and token are required for buy action');
    }
    
    // Construir URL de acción de compra
    const baseUrl = process.env.API_BASE_URL || 'http://localhost:3001';
    const actionUrl = `${baseUrl}/api/v1/blinks/buy?token=${token.toUpperCase()}&amount=${amount}`;
    
    logger.info('✅ [natural-commands] Buy action created', {
      userId,
      token,
      amount,
      actionUrl
    });
    
    return {
      success: true,
      action: {
        actionUrl,
        type: 'buy',
        token: token.toUpperCase(),
        amount: parseFloat(amount)
      },
      type: 'buy',
      message: `Buy ${amount} ${token}`,
      blinkUrl: `https://dial.to/?blink=${encodeURIComponent(actionUrl)}`
    };
    
  } catch (error) {
    logger.error('❌ [natural-commands] Buy action failed', {
      userId,
      params,
      error: error.message
    });
    
    throw new Error(`Failed to create buy action: ${error.message}`);
  }
}

/**
 * Handler para crear acción de intercambio
 * @param {Object} params - Parámetros del comando
 * @param {string} userId - ID del usuario
 * @returns {Object} - Resultado de la acción
 */
export async function createSwapAction(params, userId) {
  try {
    const { amount, fromToken, toToken } = params;
    
    // Validar parámetros
    if (!amount || !fromToken || !toToken) {
      throw new Error('Amount, fromToken and toToken are required for swap action');
    }
    
    // Por ahora, redirigir a Jupiter para swaps
    // En el futuro se puede implementar un endpoint propio
    const jupiterUrl = `https://jup.ag/swap?inputMint=${fromToken.toUpperCase()}&outputMint=${toToken.toUpperCase()}&amount=${amount}`;
    
    logger.info('✅ [natural-commands] Swap action created', {
      userId,
      fromToken,
      toToken,
      amount,
      jupiterUrl
    });
    
    return {
      success: true,
      action: {
        actionUrl: jupiterUrl,
        type: 'swap',
        fromToken: fromToken.toUpperCase(),
        toToken: toToken.toUpperCase(),
        amount: parseFloat(amount)
      },
      type: 'swap',
      message: `Swap ${amount} ${fromToken} to ${toToken}`,
      blinkUrl: jupiterUrl
    };
    
  } catch (error) {
    logger.error('❌ [natural-commands] Swap action failed', {
      userId,
      params,
      error: error.message
    });
    
    throw new Error(`Failed to create swap action: ${error.message}`);
  }
}

/**
 * Registry de handlers disponibles
 */
/**
 * Handler para crear acción de depósito
 */
export async function createDepositAction(params, userId) {
  try {
    const { amount, token, protocol } = params;
    
    if (!amount || !token || !protocol) {
      throw new Error('Amount, token and protocol are required for deposit action');
    }
    
    // Construir URL de Blink del protocolo
    const protocolUrls = {
      kamino: `https://kamino.finance/deposit?token=${token}&amount=${amount}`,
      marginfi: `https://app.marginfi.com/deposit?token=${token}&amount=${amount}`,
      jupiter: `https://jup.ag/deposit?token=${token}&amount=${amount}`
    };
    
    const actionUrl = protocolUrls[protocol.toLowerCase()] || protocolUrls.kamino;
    
    logger.info('✅ [natural-commands] Deposit action created', {
      userId,
      token,
      amount,
      protocol,
      actionUrl
    });
    
    return {
      success: true,
      action: {
        actionUrl,
        type: 'deposit',
        token: token.toUpperCase(),
        amount: parseFloat(amount),
        protocol: protocol.toLowerCase()
      },
      type: 'deposit',
      message: `Deposit ${amount} ${token} in ${protocol}`,
      blinkUrl: actionUrl
    };
    
  } catch (error) {
    logger.error('❌ [natural-commands] Deposit action failed', {
      userId,
      params,
      error: error.message
    });
    
    throw new Error(`Failed to create deposit action: ${error.message}`);
  }
}

/**
 * Handler para crear acción de retiro
 */
export async function createWithdrawAction(params, userId) {
  try {
    const { amount, token, protocol } = params;
    
    if (!amount || !token || !protocol) {
      throw new Error('Amount, token and protocol are required for withdraw action');
    }
    
    const protocolUrls = {
      kamino: `https://kamino.finance/withdraw?token=${token}&amount=${amount}`,
      marginfi: `https://app.marginfi.com/withdraw?token=${token}&amount=${amount}`,
      jupiter: `https://jup.ag/withdraw?token=${token}&amount=${amount}`
    };
    
    const actionUrl = protocolUrls[protocol.toLowerCase()] || protocolUrls.kamino;
    
    logger.info('✅ [natural-commands] Withdraw action created', {
      userId,
      token,
      amount,
      protocol,
      actionUrl
    });
    
    return {
      success: true,
      action: {
        actionUrl,
        type: 'withdraw',
        token: token.toUpperCase(),
        amount: parseFloat(amount),
        protocol: protocol.toLowerCase()
      },
      type: 'withdraw',
      message: `Withdraw ${amount} ${token} from ${protocol}`,
      blinkUrl: actionUrl
    };
    
  } catch (error) {
    logger.error('❌ [natural-commands] Withdraw action failed', {
      userId,
      params,
      error: error.message
    });
    
    throw new Error(`Failed to create withdraw action: ${error.message}`);
  }
}

/**
 * Handler para crear acción de préstamo
 */
export async function createBorrowAction(params, userId) {
  try {
    const { amount, token, protocol } = params;
    
    if (!amount || !token || !protocol) {
      throw new Error('Amount, token and protocol are required for borrow action');
    }
    
    const protocolUrls = {
      kamino: `https://kamino.finance/borrow?token=${token}&amount=${amount}`,
      marginfi: `https://app.marginfi.com/borrow?token=${token}&amount=${amount}`
    };
    
    const actionUrl = protocolUrls[protocol.toLowerCase()] || protocolUrls.marginfi;
    
    logger.info('✅ [natural-commands] Borrow action created', {
      userId,
      token,
      amount,
      protocol,
      actionUrl
    });
    
    return {
      success: true,
      action: {
        actionUrl,
        type: 'borrow',
        token: token.toUpperCase(),
        amount: parseFloat(amount),
        protocol: protocol.toLowerCase()
      },
      type: 'borrow',
      message: `Borrow ${amount} ${token} from ${protocol}`,
      blinkUrl: actionUrl
    };
    
  } catch (error) {
    logger.error('❌ [natural-commands] Borrow action failed', {
      userId,
      params,
      error: error.message
    });
    
    throw new Error(`Failed to create borrow action: ${error.message}`);
  }
}

/**
 * Handler para crear acción de pago
 */
export async function createRepayAction(params, userId) {
  try {
    const { amount, token, protocol } = params;
    
    if (!amount || !token || !protocol) {
      throw new Error('Amount, token and protocol are required for repay action');
    }
    
    const protocolUrls = {
      kamino: `https://kamino.finance/repay?token=${token}&amount=${amount}`,
      marginfi: `https://app.marginfi.com/repay?token=${token}&amount=${amount}`
    };
    
    const actionUrl = protocolUrls[protocol.toLowerCase()] || protocolUrls.marginfi;
    
    logger.info('✅ [natural-commands] Repay action created', {
      userId,
      token,
      amount,
      protocol,
      actionUrl
    });
    
    return {
      success: true,
      action: {
        actionUrl,
        type: 'repay',
        token: token.toUpperCase(),
        amount: parseFloat(amount),
        protocol: protocol.toLowerCase()
      },
      type: 'repay',
      message: `Repay ${amount} ${token} to ${protocol}`,
      blinkUrl: actionUrl
    };
    
  } catch (error) {
    logger.error('❌ [natural-commands] Repay action failed', {
      userId,
      params,
      error: error.message
    });
    
    throw new Error(`Failed to create repay action: ${error.message}`);
  }
}

/**
 * Handler para crear acción de reclamar
 */
export async function createClaimAction(params, userId) {
  try {
    const { protocol } = params;
    
    if (!protocol) {
      throw new Error('Protocol is required for claim action');
    }
    
    const protocolUrls = {
      kamino: 'https://kamino.finance/rewards',
      marginfi: 'https://app.marginfi.com/rewards',
      jupiter: 'https://jup.ag/rewards'
    };
    
    const actionUrl = protocolUrls[protocol.toLowerCase()] || protocolUrls.kamino;
    
    logger.info('✅ [natural-commands] Claim action created', {
      userId,
      protocol,
      actionUrl
    });
    
    return {
      success: true,
      action: {
        actionUrl,
        type: 'claim',
        protocol: protocol.toLowerCase()
      },
      type: 'claim',
      message: `Claim rewards from ${protocol}`,
      blinkUrl: actionUrl
    };
    
  } catch (error) {
    logger.error('❌ [natural-commands] Claim action failed', {
      userId,
      params,
      error: error.message
    });
    
    throw new Error(`Failed to create claim action: ${error.message}`);
  }
}

export const ACTION_HANDLERS = {
  createSendAction,
  createRequestAction,
  createBuyAction,
  createSwapAction,
  createDepositAction,
  createWithdrawAction,
  createBorrowAction,
  createRepayAction,
  createClaimAction
};

/**
 * Ejecutar handler basado en el comando
 * @param {Object} command - Comando parseado
 * @param {string} userId - ID del usuario
 * @returns {Object} - Resultado de la ejecución
 */
export async function executeCommand(command, userId) {
  try {
    const handler = ACTION_HANDLERS[command.handler];
    
    if (!handler) {
      throw new Error(`Handler not found: ${command.handler}`);
    }
    
    const result = await handler(command.params, userId);
    
    logger.info('✅ [natural-commands] Command executed successfully', {
      userId,
      action: command.action,
      handler: command.handler,
      result: result.type
    });
    
    return result;
    
  } catch (error) {
    logger.error('❌ [natural-commands] Command execution failed', {
      userId,
      command: command.action,
      handler: command.handler,
      error: error.message
    });
    
    throw error;
  }
}
