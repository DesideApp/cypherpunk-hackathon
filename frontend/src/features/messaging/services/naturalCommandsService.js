// src/features/messaging/services/naturalCommandsService.js
// Servicio para manejar comandos naturales en el frontend

import { apiRequest } from "@shared/services/apiService.js";
import { notify } from "@shared/services/notificationService.js";

/**
 * Parsear y ejecutar comando natural
 * @param {string} message - Mensaje del usuario
 * @returns {Promise<Object>} - Resultado del comando
 */
export async function parseNaturalCommand(message) {
  try {
    const response = await apiRequest('/api/v1/natural-commands/parse', {
      method: 'POST',
      body: JSON.stringify({ message })
    });

    if (!response || response.error) {
      throw new Error(response?.message || response?.error || 'Command parsing failed');
    }

    return response;
  } catch (error) {
    console.error('❌ [natural-commands] Parse failed:', error);
    throw error;
  }
}

/**
 * Validar comando sin ejecutarlo
 * @param {string} message - Mensaje del usuario
 * @returns {Promise<Object>} - Resultado de la validación
 */
export async function validateCommand(message) {
  try {
    const response = await apiRequest('/api/v1/natural-commands/validate', {
      method: 'POST',
      body: JSON.stringify({ message })
    });

    if (!response || response.error) {
      throw new Error(response?.message || response?.error || 'Command validation failed');
    }

    return response;
  } catch (error) {
    console.error('❌ [natural-commands] Validation failed:', error);
    throw error;
  }
}

/**
 * Obtener acciones disponibles
 * @returns {Promise<Object>} - Lista de acciones disponibles
 */
export async function getAvailableActions() {
  try {
    const response = await apiRequest('/api/v1/natural-commands/actions', {
      method: 'GET'
    });

    if (!response || response.error) {
      throw new Error(response?.message || response?.error || 'Failed to get available actions');
    }

    return response;
  } catch (error) {
    console.error('❌ [natural-commands] Get actions failed:', error);
    throw error;
  }
}

/**
 * Procesar comando natural y mostrar resultado
 * @param {string} message - Mensaje del usuario
 * @param {Function} onSuccess - Callback de éxito
 * @param {Function} onError - Callback de error
 */
export async function processNaturalCommand(message, onSuccess, onError) {
  try {
    const result = await parseNaturalCommand(message);
    
    if (result.success) {
      // Mostrar notificación de éxito
      notify(`Command recognized: ${result.command.message}`, 'success');
      
      // Ejecutar callback de éxito
      if (onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } else {
      // Mostrar sugerencias si no se detectó comando
      if (result.suggestions && result.suggestions.length > 0) {
        notify(`Try: ${result.suggestions.slice(0, 3).join(', ')}`, 'info');
      }
      
      if (onError) {
        onError(new Error(result.message || 'No command detected'));
      }
      
      return null;
    }
  } catch (error) {
    console.error('❌ [natural-commands] Process failed:', error);
    
    // Mostrar error al usuario
    notify(`Command failed: ${error.message}`, 'error');
    
    if (onError) {
      onError(error);
    }
    
    throw error;
  }
}

/**
 * Validar comando en tiempo real (para preview)
 * @param {string} message - Mensaje del usuario
 * @returns {Promise<Object|null>} - Comando validado o null
 */
export async function validateCommandRealtime(message) {
  try {
    // Solo validar si el mensaje parece un comando
    if (!isLikelyCommand(message)) {
      return null;
    }
    
    const result = await validateCommand(message);
    
    if (result.valid) {
      return {
        action: result.command.action,
        params: result.command.params,
        message: generateCommandPreview(result.command)
      };
    }
    
    return null;
  } catch (error) {
    // Silenciar errores de validación en tiempo real
    console.debug('❌ [natural-commands] Realtime validation failed:', error);
    return null;
  }
}

/**
 * Verificar si un mensaje parece un comando
 * @param {string} message - Mensaje a verificar
 * @returns {boolean} - True si parece un comando
 */
function isLikelyCommand(message) {
  if (!message || message.length < 3) return false;
  
  const commandKeywords = [
    'mándame', 'envía', 'send', 'pídeme', 'request', 'necesito',
    'compra', 'buy', 'cambia', 'swap', 'convierte', 'intercambia'
  ];
  
  const lowerMessage = message.toLowerCase();
  return commandKeywords.some(keyword => lowerMessage.includes(keyword));
}

/**
 * Generar preview del comando
 * @param {Object} command - Comando validado
 * @returns {string} - Preview del comando
 */
function generateCommandPreview(command) {
  const { action, params } = command;
  
  switch (action) {
    case 'send':
      return `💳 Send ${params.amount} ${params.token}${params.recipient ? ` to ${params.recipient}` : ''}`;
    case 'request':
      return `📋 Request ${params.amount} ${params.token}`;
    case 'buy':
      return `🛒 Buy ${params.amount} ${params.token}`;
    case 'swap':
      return `🔄 Swap ${params.amount} ${params.fromToken} to ${params.toToken}`;
    default:
      return `⚡ ${action} action`;
  }
}

/**
 * Abrir Blink URL
 * @param {string} blinkUrl - URL del Blink
 * @param {Object} options - Opciones adicionales
 */
export function openBlink(blinkUrl, options = {}) {
  if (!blinkUrl) {
    notify('No action URL provided', 'error');
    return;
  }
  
  try {
    const { target = '_blank', features = 'noopener,noreferrer' } = options;
    window.open(blinkUrl, target, features);
    notify('Opening your wallet...', 'info');
  } catch (error) {
    console.error('❌ [natural-commands] Failed to open Blink:', error);
    notify('Failed to open action', 'error');
  }
}

/**
 * Ejecutar comando natural completo
 * @param {string} message - Mensaje del usuario
 * @param {Object} options - Opciones adicionales
 */
export async function executeNaturalCommand(message, options = {}) {
  const { onSuccess, onError, openInNewTab = true } = options;
  
  try {
    const result = await processNaturalCommand(message, onSuccess, onError);
    
    if (result && result.result && result.result.blinkUrl) {
      // Abrir el Blink
      openBlink(result.result.blinkUrl, { 
        target: openInNewTab ? '_blank' : '_self' 
      });
    }
    
    return result;
  } catch (error) {
    console.error('❌ [natural-commands] Execute failed:', error);
    throw error;
  }
}






