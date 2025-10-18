// 🤖 GENERADO AUTOMÁTICAMENTE - NO EDITAR MANUALMENTE
// Ejecuta: npm run generate-intents para regenerar

import ActionDefinitions from './ActionDefinitions.mjs';
import { PatternGenerator } from './PatternGenerator.mjs';
import { CommandValidator } from './CommandValidator.mjs';
import { FeedbackGenerator } from './FeedbackGenerator.mjs';

export class NaturalCommandParser {
  constructor() {
    this.patternGenerator = new PatternGenerator();
    this.validator = new CommandValidator();
    this.feedbackGenerator = new FeedbackGenerator();
    this.actions = this.loadActions();
  }

  loadActions() {
    const actions = {};
    
    ActionDefinitions.forEach(actionDef => {
      // Usar PatternGenerator en tiempo de ejecución para máxima flexibilidad
      const patterns = this.patternGenerator.generate(actionDef);
      
      actions[actionDef.key] = {
        patterns,
        handler: actionDef.handler,
        requiredParams: actionDef.patterns,
        optionalParams: actionDef.optionalParams || [],
        description: actionDef.description,
        examples: actionDef.examples
      };
    });
    
    return actions;
  }

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

  tryParseAction(message, actionName, config) {
    for (const pattern of config.patterns) {
      const match = message.match(pattern);
      if (match) {
        return this.buildCommand(message, actionName, match, config);
      }
    }
    return null;
  }

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
    
    // Extraer parámetros requeridos
    config.requiredParams.forEach((param, index) => {
      if (match[index + 1]) {
        command.params[param] = match[index + 1];
      }
    });
    
    // Extraer parámetros opcionales
    this.extractOptionalParams(originalMessage, command, config);
    
    // Normalizar tokens
    this.normalizeTokens(command);
    
    // Validar comando
    const validation = this.validator.validateCommand(command);
    command.validation = validation;
    
    // Si hay errores críticos, no devolver el comando
    if (!validation.valid) {
      return null;
    }
    
    return command;
  }

  // 🔄 Normaliza tokens en el comando
  normalizeTokens(command) {
    const tokenParams = ['token', 'fromToken', 'toToken'];
    
    tokenParams.forEach(param => {
      if (command.params[param]) {
        const normalizedToken = this.validator.normalizeToken(command.params[param]);
        if (normalizedToken) {
          command.params[param] = normalizedToken;
        }
      }
    });
  }

  extractOptionalParams(message, command, config) {
    const mentions = this.extractMentions(message);
    if (mentions.length > 0 && config.requiredParams.includes('recipient')) {
      command.params.recipient = mentions[0];
    }
    
    const memo = this.extractMemo(message);
    if (memo) {
      command.params.memo = memo;
    }
  }

  extractMentions(text) {
    const mentionRegex = /@([a-zA-Z0-9_]+)/g;
    const mentions = [];
    let match;
    
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }
    
    return mentions;
  }

  extractMemo(text) {
    const memoRegex = /(?:por|for|memo|nota|note):\\s*(.+?)(?:\\s|$)/i;
    const match = text.match(memoRegex);
    return match ? match[1].trim() : null;
  }

  // 🛡️ Valida un comando usando el validador robusto
  validateCommand(command) {
    return this.validator.validateCommand(command);
  }

  // 🔍 Valida un token específico
  validateToken(token) {
    return this.validator.validateToken(token);
  }

  // 🏛️ Valida un protocolo específico
  validateProtocol(protocol) {
    return this.validator.validateProtocol(protocol);
  }

  // 💰 Valida una cantidad específica
  validateAmount(amount, action, token) {
    return this.validator.validateAmount(amount, action, token);
  }

  // 💬 Genera feedback completo para un mensaje
  parseWithFeedback(message) {
    const command = this.parse(message);
    const validation = command ? command.validation : null;
    
    const context = {
      message,
      availableActions: Object.keys(this.actions)
    };

    const feedback = this.feedbackGenerator.generateFeedback(command, validation, context);
    
    return {
      command,
      feedback,
      summary: this.feedbackGenerator.generateSummary(feedback)
    };
  }

  // 📝 Genera feedback formateado para display
  getFormattedFeedback(message) {
    const result = this.parseWithFeedback(message);
    return this.feedbackGenerator.formatForDisplay(result.feedback);
  }

  // 🪙 Verifica si un token es válido (método legacy)
  isValidToken(token) {
    return this.validator.normalizeToken(token) !== null;
  }

  // 🎯 Genera sugerencias contextuales
  getContextualSuggestions(message) {
    const availableActions = Object.keys(this.actions);
    return this.feedbackGenerator.generateContextSuggestion(message, availableActions);
  }

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

  getExamples(actionName) {
    const config = this.actions[actionName];
    return config ? config.examples : [];
  }

  getAvailableActions() {
    return Object.entries(this.actions).map(([name, config]) => ({
      name,
      description: config.description,
      requiredParams: config.requiredParams,
      examples: config.examples
    }));
  }
}