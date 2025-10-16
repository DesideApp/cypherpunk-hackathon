// frontend/src/utils/naturalCommandsExecutor.js
// Ejecutor de comandos naturales en el cliente

import { buildTransfer, buildRequest } from '@features/messaging/actions/blinkUrlBuilder.js';
import { notify } from '@shared/services/notificationService.js';

export class NaturalCommandExecutor {
  constructor() {
    this.actions = {
      send: this.executeSend.bind(this),
      request: this.executeRequest.bind(this),
      buy: this.executeBuy.bind(this),
      swap: this.executeSwap.bind(this)
    };
  }
  
  /**
   * Ejecutar comando natural
   * @param {Object} command - Comando parseado
   * @param {Object} context - Contexto (myWallet, activePeer, sendPaymentRequest)
   * @returns {Promise<Object>} - Resultado de la ejecución
   */
  async execute(command, context) {
    const { myWallet, activePeer, sendPaymentRequest } = context;
    
    try {
      const handler = this.actions[command.handler];
      if (!handler) {
        throw new Error(`Handler not found: ${command.handler}`);
      }
      
      const result = await handler(command.params, { myWallet, activePeer, sendPaymentRequest });
      
      console.log('✅ [natural-commands] Command executed successfully', {
        action: command.action,
        result: result.type
      });
      
      return result;
      
    } catch (error) {
      console.error('❌ [natural-commands] Command execution failed', {
        action: command.action,
        error: error.message
      });
      
      throw error;
    }
  }
  
  /**
   * Ejecutar acción de envío
   * @param {Object} params - Parámetros del comando
   * @param {Object} context - Contexto de ejecución
   * @returns {Promise<Object>} - Resultado
   */
  async executeSend(params, context) {
    console.log('💳 executeSend called with params:', params);
    console.log('💳 executeSend called with context:', context);
    
    const { amount, token, recipient, memo } = params;
    const { activePeer } = context;
    
    // Validar parámetros
    if (!amount || !token) {
      throw new Error('Amount and token are required for send action');
    }
    
    // Usar destinatario específico o el contacto activo
    const targetRecipient = recipient || activePeer;
    console.log('💳 Target recipient:', targetRecipient);
    
    if (!targetRecipient) {
      throw new Error('Recipient is required for send action');
    }
    
    // Construir la acción de transferencia
    const action = buildTransfer({
      token: token.toUpperCase(),
      to: targetRecipient,
      amount: parseFloat(amount),
      memo: memo || null
    });
    
    // Abrir el Blink
    window.open(action.dialToUrl, '_blank', 'noopener,noreferrer');
    notify('Opening your wallet...', 'info');
    
    return {
      success: true,
      action,
      type: 'send',
      message: `Send ${amount} ${token} to ${targetRecipient}`,
      blinkUrl: action.dialToUrl
    };
  }
  
  /**
   * Ejecutar acción de solicitud
   * @param {Object} params - Parámetros del comando
   * @param {Object} context - Contexto de ejecución
   * @returns {Promise<Object>} - Resultado
   */
  async executeRequest(params, context) {
    const { amount, token, memo } = params;
    const { myWallet, sendPaymentRequest } = context;
    
    // Validar parámetros
    if (!amount || !token) {
      throw new Error('Amount and token are required for request action');
    }
    
    if (!myWallet) {
      throw new Error('User wallet is required for request action');
    }
    
    if (!sendPaymentRequest) {
      throw new Error('sendPaymentRequest function is required for request action');
    }
    
    // Construir la acción de solicitud
    const action = buildRequest({
      token: token.toUpperCase(),
      to: myWallet,
      amount: parseFloat(amount),
      memo: memo || null
    });
    
    // Enviar la solicitud de pago
    const response = await sendPaymentRequest({
      token: token.toUpperCase(),
      amount: parseFloat(amount),
      actionUrl: action.actionUrl,
      solanaActionUrl: action.solanaActionUrl,
      dialToUrl: action.dialToUrl,
      blinkApiUrl: action.blinkApiUrl,
      note: memo || null
    });
    
    if (!response?.ok) {
      throw new Error(response?.reason || 'Payment request failed');
    }
    
    notify('Payment request created.', 'success');
    
    return {
      success: true,
      action,
      type: 'request',
      message: `Request ${amount} ${token}`,
      response
    };
  }
  
  /**
   * Ejecutar acción de compra
   * @param {Object} params - Parámetros del comando
   * @param {Object} context - Contexto de ejecución
   * @returns {Promise<Object>} - Resultado
   */
  async executeBuy(params, context) {
    const { amount, token } = params;
    
    // Validar parámetros
    if (!amount || !token) {
      throw new Error('Amount and token are required for buy action');
    }
    
    // Construir URL de acción de compra (usando el endpoint existente)
    const baseUrl = window.location.origin;
    const actionUrl = `${baseUrl}/api/v1/blinks/buy?token=${token.toUpperCase()}&amount=${amount}`;
    const dialToUrl = `https://dial.to/?blink=${encodeURIComponent(actionUrl)}`;
    
    // Abrir el Blink
    window.open(dialToUrl, '_blank', 'noopener,noreferrer');
    notify('Opening buy action...', 'info');
    
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
      blinkUrl: dialToUrl
    };
  }
  
  /**
   * Ejecutar acción de intercambio
   * @param {Object} params - Parámetros del comando
   * @param {Object} context - Contexto de ejecución
   * @returns {Promise<Object>} - Resultado
   */
  async executeSwap(params, context) {
    const { amount, fromToken, toToken } = params;
    
    // Validar parámetros
    if (!amount || !fromToken || !toToken) {
      throw new Error('Amount, fromToken and toToken are required for swap action');
    }
    
    // Por ahora, redirigir a Jupiter para swaps
    // En el futuro se puede implementar un endpoint propio
    const jupiterUrl = `https://jup.ag/swap?inputMint=${fromToken.toUpperCase()}&outputMint=${toToken.toUpperCase()}&amount=${amount}`;
    
    // Abrir Jupiter
    window.open(jupiterUrl, '_blank', 'noopener,noreferrer');
    notify('Opening Jupiter swap...', 'info');
    
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
  }
}
