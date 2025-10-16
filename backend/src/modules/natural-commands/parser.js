// src/modules/natural-commands/parser.js
// Parser modular para comandos naturales

import { ACTION_REGISTRY, extractMentions, extractMemo } from './actions-registry.js';

export class NaturalCommandParser {
  constructor() {
    this.actions = { ...ACTION_REGISTRY };
  }
  
  /**
   * Registrar nueva acción dinámicamente
   * @param {string} actionName - Nombre de la acción
   * @param {Object} config - Configuración de la acción
   */
  registerAction(actionName, config) {
    this.actions[actionName] = {
      ...config,
      patterns: config.patterns || [],
      handler: config.handler || `create${actionName.charAt(0).toUpperCase() + actionName.slice(1)}Action`,
      requiredParams: config.requiredParams || [],
      optionalParams: config.optionalParams || []
    };
  }
  
  /**
   * Parsear comando natural
   * @param {string} message - Mensaje del usuario
   * @returns {Object|null} - Comando parseado o null si no coincide
   */
  parse(message) {
    if (!message || typeof message !== 'string') {
      return null;
    }
    
    const trimmedMessage = message.trim();
    
    for (const [actionName, config] of Object.entries(this.actions)) {
      const result = this.tryParseAction(trimmedMessage, actionName, config);
      if (result) {
        return result;
      }
    }
    
    return null;
  }
  
  /**
   * Intentar parsear una acción específica
   * @param {string} message - Mensaje a parsear
   * @param {string} actionName - Nombre de la acción
   * @param {Object} config - Configuración de la acción
   * @returns {Object|null} - Resultado del parseo o null
   */
  tryParseAction(message, actionName, config) {
    for (const pattern of config.patterns) {
      const match = message.match(pattern);
      if (match) {
        return this.buildCommand(message, actionName, match, config);
      }
    }
    return null;
  }
  
  /**
   * Construir objeto de comando
   * @param {string} originalMessage - Mensaje original
   * @param {string} actionName - Nombre de la acción
   * @param {Array} match - Resultado del regex match
   * @param {Object} config - Configuración de la acción
   * @returns {Object} - Comando construido
   */
  buildCommand(originalMessage, actionName, match, config) {
    const command = {
      action: actionName,
      handler: config.handler,
      params: {},
      metadata: {
        originalMessage,
        confidence: 1.0, // Regex match = alta confianza
        extractedAt: new Date().toISOString()
      }
    };
    
    // Mapear grupos de regex a parámetros requeridos
    config.requiredParams.forEach((param, index) => {
      if (match[index + 1]) {
        command.params[param] = match[index + 1];
      }
    });
    
    // Extraer parámetros opcionales del mensaje original
    this.extractOptionalParams(originalMessage, command, config);
    
    return command;
  }
  
  /**
   * Extraer parámetros opcionales del mensaje
   * @param {string} message - Mensaje original
   * @param {Object} command - Comando a completar
   * @param {Object} config - Configuración de la acción
   */
  extractOptionalParams(message, command, config) {
    // Extraer menciones (@usuario)
    const mentions = extractMentions(message);
    if (mentions.length > 0 && config.optionalParams.includes('recipient')) {
      command.params.recipient = mentions[0]; // Usar la primera mención
    }
    
    // Extraer memo/nota
    const memo = extractMemo(message);
    if (memo && config.optionalParams.includes('memo')) {
      command.params.memo = memo;
    }
  }
  
  /**
   * Validar comando parseado
   * @param {Object} command - Comando a validar
   * @returns {Object} - Resultado de la validación
   */
  validateCommand(command) {
    if (!command || !command.action) {
      return { valid: false, error: 'Invalid command structure' };
    }
    
    const config = this.actions[command.action];
    if (!config) {
      return { valid: false, error: `Unknown action: ${command.action}` };
    }
    
    // Validar parámetros requeridos
    for (const param of config.requiredParams) {
      if (!command.params[param]) {
        return { valid: false, error: `Missing required parameter: ${param}` };
      }
    }
    
    // Validar tokens
    if (command.params.token && !this.isValidToken(command.params.token)) {
      return { valid: false, error: `Invalid token: ${command.params.token}` };
    }
    
    if (command.params.fromToken && !this.isValidToken(command.params.fromToken)) {
      return { valid: false, error: `Invalid fromToken: ${command.params.fromToken}` };
    }
    
    if (command.params.toToken && !this.isValidToken(command.params.toToken)) {
      return { valid: false, error: `Invalid toToken: ${command.params.toToken}` };
    }
    
    // Validar cantidad
    if (command.params.amount) {
      const amount = parseFloat(command.params.amount);
      if (isNaN(amount) || amount <= 0) {
        return { valid: false, error: `Invalid amount: ${command.params.amount}` };
      }
    }
    
    return { valid: true };
  }
  
  /**
   * Verificar si un token es válido
   * @param {string} token - Token a validar
   * @returns {boolean} - True si es válido
   */
  isValidToken(token) {
    const validTokens = ['SOL', 'USDC', 'USDT'];
    return validTokens.includes(token.toUpperCase());
  }
  
  /**
   * Obtener lista de acciones disponibles
   * @returns {Array} - Lista de acciones
   */
  getAvailableActions() {
    return Object.entries(this.actions).map(([name, config]) => ({
      name,
      description: config.description,
      requiredParams: config.requiredParams,
      optionalParams: config.optionalParams
    }));
  }
  
  /**
   * Obtener ejemplos de comandos para una acción
   * @param {string} actionName - Nombre de la acción
   * @returns {Array} - Ejemplos de comandos
   */
  getActionExamples(actionName) {
    const config = this.actions[actionName];
    if (!config) return [];
    
    // Generar ejemplos básicos basados en los patrones
    const examples = [];
    config.patterns.forEach(pattern => {
      const patternStr = pattern.toString();
      if (patternStr.includes('mándame')) {
        examples.push('mándame 5 SOL');
      } else if (patternStr.includes('envía')) {
        examples.push('envía 2 USDC');
      } else if (patternStr.includes('pídeme')) {
        examples.push('pídeme 10 USDT');
      } else if (patternStr.includes('compra')) {
        examples.push('compra 0.5 SOL');
      } else if (patternStr.includes('cambia')) {
        examples.push('cambia 1 SOL a USDC');
      }
    });
    
    return [...new Set(examples)]; // Eliminar duplicados
  }
}






