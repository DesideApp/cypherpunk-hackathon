// frontend/src/utils/naturalCommandsParser.js
// Parser de comandos naturales para el cliente

export class NaturalCommandParser {
  constructor() {
    this.actions = {
      send: {
        patterns: [
          /mándame\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /envía\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /te envío\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /quiero enviar\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /send\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i
        ],
        handler: 'send',
        requiredParams: ['amount', 'token'],
        description: 'Enviar tokens a otro usuario'
      },
      
      request: {
        patterns: [
          /pídeme\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /necesito\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /quiero recibir\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /request\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /solicita\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i
        ],
        handler: 'request',
        requiredParams: ['amount', 'token'],
        description: 'Solicitar tokens de otro usuario'
      },
      
      buy: {
        patterns: [
          /compra\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /quiero comprar\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /buy\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i,
          /adquiere\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)/i
        ],
        handler: 'buy',
        requiredParams: ['amount', 'token'],
        description: 'Comprar tokens con SOL'
      },
      
      swap: {
        patterns: [
          /cambia\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)\s+a\s+(SOL|USDC|USDT)/i,
          /convierte\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)\s+en\s+(SOL|USDC|USDT)/i,
          /swap\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)\s+to\s+(SOL|USDC|USDT)/i,
          /intercambia\s+(\d+(?:\.\d+)?)\s+(SOL|USDC|USDT)\s+por\s+(SOL|USDC|USDT)/i
        ],
        handler: 'swap',
        requiredParams: ['amount', 'fromToken', 'toToken'],
        description: 'Intercambiar tokens'
      }
    };
  }
  
  /**
   * Parsear comando natural
   * @param {string} message - Mensaje del usuario
   * @returns {Object|null} - Comando parseado o null
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
        confidence: 1.0,
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
    const mentions = this.extractMentions(message);
    if (mentions.length > 0) {
      command.params.recipient = mentions[0];
    }
    
    // Extraer memo/nota
    const memo = this.extractMemo(message);
    if (memo) {
      command.params.memo = memo;
    }
  }
  
  /**
   * Extraer menciones de usuario
   * @param {string} text - Texto a analizar
   * @returns {Array} - Lista de menciones
   */
  extractMentions(text) {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }
  
  /**
   * Extraer memo/nota
   * @param {string} text - Texto a analizar
   * @returns {string|null} - Memo extraído
   */
  extractMemo(text) {
    const memoRegex = /(?:por|for|memo|nota|note):\s*(.+?)(?:\s|$)/i;
    const match = text.match(memoRegex);
    return match ? match[1].trim() : null;
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
   * Generar preview del comando
   * @param {Object} command - Comando parseado
   * @returns {string} - Preview del comando
   */
  generatePreview(command) {
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
   * Obtener ejemplos de comandos
   * @returns {Array} - Lista de ejemplos
   */
  getExamples() {
    return [
      'mándame 5 SOL',
      'envía 2 USDC',
      'pídeme 10 USDT',
      'compra 0.5 SOL',
      'cambia 1 SOL a USDC'
    ];
  }
}

