// 🛡️ Validador Robusto - Sistema de validación inteligente
// Valida tokens, protocolos, cantidades y parámetros sin IA

export class CommandValidator {
  constructor() {
    this.tokenRegistry = this.buildTokenRegistry();
    this.protocolRegistry = this.buildProtocolRegistry();
    this.amountLimits = this.buildAmountLimits();
    this.validationRules = this.buildValidationRules();
  }

  // 🪙 Registro de tokens válidos con metadatos
  buildTokenRegistry() {
    return {
      'SOL': {
        symbol: 'SOL',
        name: 'Solana',
        decimals: 9,
        minAmount: 0.000000001,
        maxAmount: 1000000,
        aliases: ['sol', 'Solana', 'solana', 'SOLs', 'sols']
      },
      'USDC': {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        minAmount: 0.000001,
        maxAmount: 10000000,
        aliases: ['usdc']
      },
      'USDT': {
        symbol: 'USDT',
        name: 'Tether',
        decimals: 6,
        minAmount: 0.000001,
        maxAmount: 10000000,
        aliases: ['usdt', 'tether']
      },
      'BONK': {
        symbol: 'BONK',
        name: 'Bonk',
        decimals: 5,
        minAmount: 0.00001,
        maxAmount: 1000000000,
        aliases: ['bonk']
      },
      'JUP': {
        symbol: 'JUP',
        name: 'Jupiter',
        decimals: 6,
        minAmount: 0.000001,
        maxAmount: 1000000,
        aliases: ['jup', 'jupiter']
      }
    };
  }

  // 🏛️ Registro de protocolos DeFi válidos
  buildProtocolRegistry() {
    return {
      'kamino': {
        name: 'Kamino',
        type: 'lending',
        supportedTokens: ['SOL', 'USDC', 'USDT'],
        description: 'Lending protocol on Solana'
      },
      'marginfi': {
        name: 'MarginFi',
        type: 'lending',
        supportedTokens: ['SOL', 'USDC', 'USDT'],
        description: 'Margin trading and lending'
      },
      'jupiter': {
        name: 'Jupiter',
        type: 'dex',
        supportedTokens: ['SOL', 'USDC', 'USDT', 'BONK', 'JUP'],
        description: 'DEX aggregator'
      },
      'orca': {
        name: 'Orca',
        type: 'dex',
        supportedTokens: ['SOL', 'USDC', 'USDT'],
        description: 'Automated market maker'
      }
    };
  }

  // 💰 Límites de cantidades por acción
  buildAmountLimits() {
    return {
      send: { min: 0.000001, max: 1000000 },
      request: { min: 0.000001, max: 100000 },
      buy: { min: 0.000001, max: 100000 },
      swap: { min: 0.000001, max: 100000 },
      deposit: { min: 0.000001, max: 1000000 },
      withdraw: { min: 0.000001, max: 1000000 },
      borrow: { min: 0.000001, max: 100000 },
      repay: { min: 0.000001, max: 100000 },
      claim: { min: 0, max: Infinity }
    };
  }

  // 📋 Reglas de validación por acción
  buildValidationRules() {
    return {
      send: {
        required: ['amount', 'token'],
        optional: ['recipient', 'memo'],
        tokenRequired: true,
        protocolRequired: false
      },
      request: {
        required: ['amount', 'token'],
        optional: ['memo'],
        tokenRequired: true,
        protocolRequired: false
      },
      buy: {
        required: ['amount', 'token'],
        optional: [],
        tokenRequired: true,
        protocolRequired: false
      },
      swap: {
        required: ['amount', 'fromToken', 'toToken'],
        optional: [],
        tokenRequired: true,
        protocolRequired: false
      },
      deposit: {
        required: ['amount', 'token', 'protocol'],
        optional: [],
        tokenRequired: true,
        protocolRequired: true
      },
      withdraw: {
        required: ['amount', 'token', 'protocol'],
        optional: [],
        tokenRequired: true,
        protocolRequired: true
      },
      borrow: {
        required: ['amount', 'token', 'protocol'],
        optional: [],
        tokenRequired: true,
        protocolRequired: true
      },
      repay: {
        required: ['amount', 'token', 'protocol'],
        optional: [],
        tokenRequired: true,
        protocolRequired: true
      },
      claim: {
        required: ['protocol'],
        optional: ['token'],
        tokenRequired: false,
        protocolRequired: true
      }
    };
  }

  // 🔍 Valida un comando completo
  validateCommand(command) {
    const errors = [];
    const warnings = [];
    const suggestions = [];

    if (!command || !command.action) {
      return {
        valid: false,
        errors: ['Comando inválido: falta acción'],
        warnings: [],
        suggestions: []
      };
    }

    const action = command.action;
    const params = command.params || {};
    const rules = this.validationRules[action];

    if (!rules) {
      return {
        valid: false,
        errors: [`Acción no reconocida: ${action}`],
        warnings: [],
        suggestions: []
      };
    }

    // Validar parámetros requeridos
    rules.required.forEach(param => {
      if (!params[param]) {
        errors.push(`Parámetro requerido faltante: ${param}`);
      }
    });

    // Validar tokens
    if (rules.tokenRequired) {
      const tokenValidation = this.validateToken(params.token);
      if (!tokenValidation.valid) {
        errors.push(...tokenValidation.errors);
        suggestions.push(...tokenValidation.suggestions);
      }
    }

    // Validar protocolos
    if (rules.protocolRequired) {
      const protocolValidation = this.validateProtocol(params.protocol);
      if (!protocolValidation.valid) {
        errors.push(...protocolValidation.errors);
        suggestions.push(...protocolValidation.suggestions);
      }
    }

    // Validar cantidades
    if (params.amount) {
      const amountValidation = this.validateAmount(params.amount, action, params.token);
      if (!amountValidation.valid) {
        errors.push(...amountValidation.errors);
        warnings.push(...amountValidation.warnings);
      }
    }

    // Validar destinatario
    if (params.recipient) {
      const recipientValidation = this.validateRecipient(params.recipient);
      if (!recipientValidation.valid) {
        warnings.push(...recipientValidation.warnings);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  // 🪙 Valida un token
  validateToken(token) {
    if (!token) {
      return {
        valid: false,
        errors: ['Token no especificado'],
        suggestions: []
      };
    }

    const normalizedToken = this.normalizeToken(token);
    if (!this.tokenRegistry[normalizedToken]) {
      const suggestions = this.findSimilarTokens(token);
      return {
        valid: false,
        errors: [`Token no válido: ${token}`],
        suggestions: suggestions.length > 0 ? [`¿Quisiste decir: ${suggestions.join(', ')}?`] : []
      };
    }

    return { valid: true, errors: [], suggestions: [] };
  }

  // 🏛️ Valida un protocolo
  validateProtocol(protocol) {
    if (!protocol) {
      return {
        valid: false,
        errors: ['Protocolo no especificado'],
        suggestions: []
      };
    }

    const normalizedProtocol = protocol.toLowerCase();
    if (!this.protocolRegistry[normalizedProtocol]) {
      const suggestions = this.findSimilarProtocols(protocol);
      return {
        valid: false,
        errors: [`Protocolo no válido: ${protocol}`],
        suggestions: suggestions.length > 0 ? [`¿Quisiste decir: ${suggestions.join(', ')}?`] : []
      };
    }

    return { valid: true, errors: [], suggestions: [] };
  }

  // 💰 Valida una cantidad
  validateAmount(amount, action, token) {
    const errors = [];
    const warnings = [];

    // Convertir cantidad especial
    let numericAmount = this.parseAmount(amount);
    
    if (numericAmount === null) {
      errors.push(`Cantidad no válida: ${amount}`);
      return { valid: false, errors, warnings };
    }

    // Validar límites por acción
    const limits = this.amountLimits[action];
    if (limits) {
      if (numericAmount < limits.min) {
        warnings.push(`Cantidad muy pequeña: ${amount} (mínimo: ${limits.min})`);
      }
      if (numericAmount > limits.max) {
        warnings.push(`Cantidad muy grande: ${amount} (máximo: ${limits.max})`);
      }
    }

    // Validar límites por token
    if (token) {
      const normalizedToken = this.normalizeToken(token);
      const tokenInfo = this.tokenRegistry[normalizedToken];
      if (tokenInfo) {
        if (numericAmount < tokenInfo.minAmount) {
          warnings.push(`Cantidad menor al mínimo del token: ${amount} (mínimo: ${tokenInfo.minAmount})`);
        }
        if (numericAmount > tokenInfo.maxAmount) {
          warnings.push(`Cantidad mayor al máximo del token: ${amount} (máximo: ${tokenInfo.maxAmount})`);
        }
      }
    }

    return { valid: true, errors, warnings };
  }

  // 👤 Valida un destinatario
  validateRecipient(recipient) {
    const warnings = [];

    // Validar formato básico
    if (!/^[a-zA-Z0-9_]+$/.test(recipient)) {
      warnings.push(`Formato de destinatario inválido: ${recipient}`);
    }

    if (recipient.length < 3) {
      warnings.push(`Nombre de destinatario muy corto: ${recipient}`);
    }

    if (recipient.length > 50) {
      warnings.push(`Nombre de destinatario muy largo: ${recipient}`);
    }

    return { valid: warnings.length === 0, warnings };
  }

  // 🔄 Normaliza un token
  normalizeToken(token) {
    if (!token) return null;
    
    const normalizedToken = token.toUpperCase();
    
    // Buscar por símbolo exacto
    if (this.tokenRegistry[normalizedToken]) {
      return normalizedToken;
    }

    // Buscar por alias
    for (const [symbol, info] of Object.entries(this.tokenRegistry)) {
      if (info.aliases.includes(token.toLowerCase())) {
        return symbol;
      }
    }

    return normalizedToken;
  }

  // 🔍 Encuentra tokens similares
  findSimilarTokens(token) {
    const suggestions = [];
    const tokenLower = token.toLowerCase();
    
    for (const [symbol, info] of Object.entries(this.tokenRegistry)) {
      if (symbol.toLowerCase().includes(tokenLower) || 
          info.name.toLowerCase().includes(tokenLower) ||
          info.aliases.some(alias => alias.includes(tokenLower))) {
        suggestions.push(symbol);
      }
    }

    return suggestions.slice(0, 3); // Máximo 3 sugerencias
  }

  // 🔍 Encuentra protocolos similares
  findSimilarProtocols(protocol) {
    const suggestions = [];
    const protocolLower = protocol.toLowerCase();
    
    for (const [key, info] of Object.entries(this.protocolRegistry)) {
      if (key.includes(protocolLower) || 
          info.name.toLowerCase().includes(protocolLower)) {
        suggestions.push(key);
      }
    }

    return suggestions.slice(0, 3); // Máximo 3 sugerencias
  }

  // 📊 Parsea una cantidad (números, palabras, especiales)
  parseAmount(amount) {
    if (typeof amount === 'number') {
      return amount;
    }

    if (typeof amount !== 'string') {
      return null;
    }

    const amountStr = amount.toLowerCase().trim();

    // Palabras especiales
    if (['all', 'todo', 'todos', 'max', 'máximo', 'máx', 'maximum'].includes(amountStr)) {
      return Infinity; // Se manejará en el contexto específico
    }

    // Números en palabras
    const wordNumbers = {
      'uno': 1, 'one': 1,
      'dos': 2, 'two': 2,
      'tres': 3, 'three': 3,
      'cuatro': 4, 'four': 4,
      'cinco': 5, 'five': 5,
      'seis': 6, 'six': 6,
      'siete': 7, 'seven': 7,
      'ocho': 8, 'eight': 8,
      'nueve': 9, 'nine': 9,
      'diez': 10, 'ten': 10
    };

    if (wordNumbers[amountStr]) {
      return wordNumbers[amountStr];
    }

    // Números con porcentaje
    if (amountStr.endsWith('%')) {
      const num = parseFloat(amountStr.slice(0, -1));
      return isNaN(num) ? null : num;
    }

    // Números normales
    const num = parseFloat(amountStr);
    return isNaN(num) ? null : num;
  }

  // 📈 Obtiene estadísticas de validación
  getStats() {
    return {
      supportedTokens: Object.keys(this.tokenRegistry).length,
      supportedProtocols: Object.keys(this.protocolRegistry).length,
      validationRules: Object.keys(this.validationRules).length,
      amountLimits: Object.keys(this.amountLimits).length
    };
  }
}
