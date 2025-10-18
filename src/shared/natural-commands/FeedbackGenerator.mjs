// 💬 Sistema de Feedback Inteligente
// Genera mensajes claros, contextuales y útiles sin preguntas

export class FeedbackGenerator {
  constructor() {
    this.messageTemplates = this.buildMessageTemplates();
    this.suggestionEngine = this.buildSuggestionEngine();
    this.contextAnalyzer = this.buildContextAnalyzer();
  }

  // 📝 Plantillas de mensajes por contexto
  buildMessageTemplates() {
    return {
      // Mensajes de éxito
      success: {
        detected: "✅ Comando detectado: {action}",
        parsed: "📊 Parámetros extraídos: {params}",
        validated: "🛡️ Comando validado correctamente"
      },

      // Mensajes de error (sin preguntas)
      error: {
        notDetected: "❌ No entendí el comando",
        invalidToken: "❌ Token no válido: {token}",
        invalidProtocol: "❌ Protocolo no válido: {protocol}",
        invalidAmount: "❌ Cantidad no válida: {amount}",
        missingParam: "❌ Falta parámetro: {param}",
        invalidAction: "❌ Acción no reconocida: {action}"
      },

      // Mensajes de warning
      warning: {
        smallAmount: "⚠️ Cantidad pequeña: {amount}",
        largeAmount: "⚠️ Cantidad grande: {amount}",
        invalidRecipient: "⚠️ Formato de destinatario inválido: {recipient}"
      },

      // Sugerencias contextuales
      suggestion: {
        similarTokens: "💡 Tokens disponibles: {tokens}",
        similarProtocols: "💡 Protocolos disponibles: {protocols}",
        availableActions: "💡 Acciones disponibles: {actions}",
        examples: "💡 Ejemplos: {examples}"
      }
    };
  }

  // 🧠 Motor de sugerencias inteligentes
  buildSuggestionEngine() {
    return {
      // Sugerencias por tipo de error
      tokenSuggestions: (invalidToken, availableTokens) => {
        const suggestions = this.findSimilarTokens(invalidToken, availableTokens);
        return suggestions.length > 0 
          ? `¿Quisiste decir: ${suggestions.join(', ')}?`
          : `Tokens disponibles: ${availableTokens.join(', ')}`;
      },

      protocolSuggestions: (invalidProtocol, availableProtocols) => {
        const suggestions = this.findSimilarProtocols(invalidProtocol, availableProtocols);
        return suggestions.length > 0 
          ? `¿Quisiste decir: ${suggestions.join(', ')}?`
          : `Protocolos disponibles: ${availableProtocols.join(', ')}`;
      },

      actionSuggestions: (invalidAction, availableActions) => {
        const suggestions = this.findSimilarActions(invalidAction, availableActions);
        return suggestions.length > 0 
          ? `¿Quisiste decir: ${suggestions.join(', ')}?`
          : `Acciones disponibles: ${availableActions.join(', ')}`;
      },

      contextSuggestions: (message, availableActions) => {
        // Analizar el contexto del mensaje para sugerir acciones
        const keywords = this.extractKeywords(message);
        const suggestedActions = this.matchKeywordsToActions(keywords, availableActions);
        
        if (suggestedActions.length > 0) {
          return `Basado en tu mensaje, puedes intentar: ${suggestedActions.join(', ')}`;
        }
        
        return `Acciones disponibles: ${availableActions.join(', ')}`;
      }
    };
  }

  // 🔍 Analizador de contexto
  buildContextAnalyzer() {
    return {
      // Palabras clave por acción
      actionKeywords: {
        send: ['envía', 'envia', 'manda', 'transfiere', 'send', 'transfer', 'give'],
        request: ['pide', 'pide', 'necesito', 'quiero', 'request', 'need', 'want'],
        buy: ['compra', 'compra', 'cómprame', 'comprame', 'buy', 'purchase', 'get'],
        swap: ['cambia', 'cambia', 'intercambia', 'convierte', 'swap', 'exchange', 'convert'],
        deposit: ['deposita', 'deposita', 'ingresa', 'stake', 'deposit', 'enter', 'put'],
        withdraw: ['retira', 'retira', 'saca', 'extrae', 'withdraw', 'take', 'extract'],
        borrow: ['presta', 'presta', 'toma prestado', 'borrow', 'loan'],
        repay: ['paga', 'paga', 'devuelve', 'repay', 'pay back'],
        claim: ['reclama', 'reclama', 'cobra', 'claim', 'collect']
      },

      // Tokens mencionados
      tokenKeywords: ['SOL', 'USDC', 'USDT', 'BONK', 'JUP', 'sol', 'usdc', 'usdt', 'bonk', 'jup'],

      // Protocolos mencionados
      protocolKeywords: ['kamino', 'marginfi', 'jupiter', 'orca']
    };
  }

  // 🎯 Genera feedback completo para un comando
  generateFeedback(command, validation, context = {}) {
    const feedback = {
      success: false,
      messages: [],
      suggestions: [],
      warnings: [],
      errors: []
    };

    if (!command) {
      // Comando no detectado
      feedback.errors.push(this.messageTemplates.error.notDetected);
      feedback.suggestions.push(this.generateContextSuggestion(context.message, context.availableActions));
      return feedback;
    }

    // Comando detectado
    feedback.success = true;
    feedback.messages.push(
      this.messageTemplates.success.detected.replace('{action}', command.action)
    );

    // Mostrar parámetros extraídos
    if (command.params && Object.keys(command.params).length > 0) {
      const paramsStr = Object.entries(command.params)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
      feedback.messages.push(
        this.messageTemplates.success.parsed.replace('{params}', paramsStr)
      );
    }

    // Procesar validación
    if (validation) {
      if (validation.valid) {
        feedback.messages.push(this.messageTemplates.success.validated);
      }

      // Errores
      validation.errors.forEach(error => {
        feedback.errors.push(this.formatErrorMessage(error, command));
      });

      // Warnings
      validation.warnings.forEach(warning => {
        feedback.warnings.push(this.formatWarningMessage(warning, command));
      });

      // Sugerencias
      validation.suggestions.forEach(suggestion => {
        feedback.suggestions.push(suggestion);
      });
    }

    return feedback;
  }

  // 🔧 Genera sugerencia contextual
  generateContextSuggestion(message, availableActions) {
    if (!message || !availableActions) {
      return "Comandos disponibles: envía, pide, compra, cambia, deposita, retira";
    }

    return this.suggestionEngine.contextSuggestions(message, availableActions);
  }

  // 📝 Formatea mensaje de error
  formatErrorMessage(error, command) {
    if (error.includes('Token no válido')) {
      const token = error.match(/Token no válido: (.+)/)?.[1];
      return this.messageTemplates.error.invalidToken.replace('{token}', token || 'desconocido');
    }

    if (error.includes('Protocolo no válido')) {
      const protocol = error.match(/Protocolo no válido: (.+)/)?.[1];
      return this.messageTemplates.error.invalidProtocol.replace('{protocol}', protocol || 'desconocido');
    }

    if (error.includes('Cantidad no válida')) {
      const amount = error.match(/Cantidad no válida: (.+)/)?.[1];
      return this.messageTemplates.error.invalidAmount.replace('{amount}', amount || 'desconocida');
    }

    if (error.includes('Parámetro requerido faltante')) {
      const param = error.match(/Parámetro requerido faltante: (.+)/)?.[1];
      return this.messageTemplates.error.missingParam.replace('{param}', param || 'desconocido');
    }

    return error; // Mensaje original si no se puede formatear
  }

  // ⚠️ Formatea mensaje de warning
  formatWarningMessage(warning, command) {
    if (warning.includes('Cantidad muy pequeña')) {
      const amount = warning.match(/Cantidad muy pequeña: (.+)/)?.[1];
      return this.messageTemplates.warning.smallAmount.replace('{amount}', amount || 'desconocida');
    }

    if (warning.includes('Cantidad muy grande')) {
      const amount = warning.match(/Cantidad muy grande: (.+)/)?.[1];
      return this.messageTemplates.warning.largeAmount.replace('{amount}', amount || 'desconocida');
    }

    if (warning.includes('Formato de destinatario inválido')) {
      const recipient = warning.match(/Formato de destinatario inválido: (.+)/)?.[1];
      return this.messageTemplates.warning.invalidRecipient.replace('{recipient}', recipient || 'desconocido');
    }

    return warning; // Mensaje original si no se puede formatear
  }

  // 🔍 Encuentra tokens similares
  findSimilarTokens(invalidToken, availableTokens) {
    const suggestions = [];
    const tokenLower = invalidToken.toLowerCase();
    
    availableTokens.forEach(token => {
      if (token.toLowerCase().includes(tokenLower) || 
          tokenLower.includes(token.toLowerCase())) {
        suggestions.push(token);
      }
    });

    return suggestions.slice(0, 3); // Máximo 3 sugerencias
  }

  // 🔍 Encuentra protocolos similares
  findSimilarProtocols(invalidProtocol, availableProtocols) {
    const suggestions = [];
    const protocolLower = invalidProtocol.toLowerCase();
    
    availableProtocols.forEach(protocol => {
      if (protocol.toLowerCase().includes(protocolLower) || 
          protocolLower.includes(protocol.toLowerCase())) {
        suggestions.push(protocol);
      }
    });

    return suggestions.slice(0, 3); // Máximo 3 sugerencias
  }

  // 🔍 Encuentra acciones similares
  findSimilarActions(invalidAction, availableActions) {
    const suggestions = [];
    const actionLower = invalidAction.toLowerCase();
    
    availableActions.forEach(action => {
      if (action.toLowerCase().includes(actionLower) || 
          actionLower.includes(action.toLowerCase())) {
        suggestions.push(action);
      }
    });

    return suggestions.slice(0, 3); // Máximo 3 sugerencias
  }

  // 🔑 Extrae palabras clave del mensaje
  extractKeywords(message) {
    const words = message.toLowerCase().split(/\s+/);
    const keywords = [];

    // Buscar palabras clave de acciones
    Object.entries(this.contextAnalyzer.actionKeywords).forEach(([action, keywords]) => {
      keywords.forEach(keyword => {
        if (words.includes(keyword.toLowerCase())) {
          keywords.push(action);
        }
      });
    });

    return keywords;
  }

  // 🎯 Coincide palabras clave con acciones
  matchKeywordsToActions(keywords, availableActions) {
    const matchedActions = [];

    keywords.forEach(keyword => {
      if (availableActions.includes(keyword)) {
        matchedActions.push(keyword);
      }
    });

    return [...new Set(matchedActions)]; // Eliminar duplicados
  }

  // 📊 Genera resumen de feedback
  generateSummary(feedback) {
    const summary = {
      status: feedback.success ? 'success' : 'error',
      totalMessages: feedback.messages.length + feedback.errors.length + feedback.warnings.length + feedback.suggestions.length,
      hasErrors: feedback.errors.length > 0,
      hasWarnings: feedback.warnings.length > 0,
      hasSuggestions: feedback.suggestions.length > 0
    };

    return summary;
  }

  // 🎨 Formatea feedback para display
  formatForDisplay(feedback) {
    const lines = [];

    // Mensajes de éxito
    feedback.messages.forEach(message => {
      lines.push(`✅ ${message}`);
    });

    // Errores
    feedback.errors.forEach(error => {
      lines.push(`❌ ${error}`);
    });

    // Warnings
    feedback.warnings.forEach(warning => {
      lines.push(`⚠️ ${warning}`);
    });

    // Sugerencias
    feedback.suggestions.forEach(suggestion => {
      lines.push(`💡 ${suggestion}`);
    });

    return lines.join('\n');
  }

  // 📈 Obtiene estadísticas del generador
  getStats() {
    return {
      messageTemplates: Object.keys(this.messageTemplates).length,
      suggestionEngines: Object.keys(this.suggestionEngine).length,
      actionKeywords: Object.keys(this.contextAnalyzer.actionKeywords).length,
      tokenKeywords: this.contextAnalyzer.tokenKeywords.length,
      protocolKeywords: this.contextAnalyzer.protocolKeywords.length
    };
  }
}
