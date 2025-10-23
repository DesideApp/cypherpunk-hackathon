// src/features/messaging/actions/command-parser.js
// Parseador de comandos naturales

import React from 'react';
import { useBlinkExplorer } from "@features/messaging/hooks/useBlinkExplorer";
// Sistema modular que detecta comandos y los convierte en acciones

import { detectAction, processAction, detectBlinkUrls } from './actions-registry.js';

/**
 * Parser principal de comandos
 * Detecta tanto comandos de acciones como URLs de blinks
 */
export class CommandParser {
  constructor() {
    this.blinkExplorer = null;
  }
  
  /**
   * Inicializa el parser con callbacks
   * @param {Object} callbacks - Callbacks para diferentes eventos
   */
  initialize(callbacks = {}) {
    this.callbacks = {
      onActionDetected: callbacks.onActionDetected || (() => {}),
      onBlinkDetected: callbacks.onBlinkDetected || (() => {}),
      onError: callbacks.onError || (() => {}),
      ...callbacks
    };
    
    this.blinkExplorer = useBlinkExplorer(this.callbacks.onBlinkDetected);
  }
  
  /**
   * Procesa un texto y detecta comandos o blinks
   * @param {string} text - Texto a procesar
   * @param {Object} context - Contexto (peerWallet, myWallet, etc.)
   * @returns {Object} - Resultado del procesamiento
   */
  async processText(text, context = {}) {
    const result = {
      hasCommand: false,
      hasBlink: false,
      action: null,
      blinks: [],
      originalText: text
    };
    
    try {
      // 1. Detectar comandos de acciones
      const actionDetected = detectAction(text);
      if (actionDetected) {
        result.hasCommand = true;
        result.action = await processAction(text, context);
        
        if (result.action.success) {
          this.callbacks.onActionDetected?.(result.action);
        } else {
          this.callbacks.onError?.(result.action.error);
        }
      }
      
      // 2. Detectar URLs de blinks
      const blinkUrls = detectBlinkUrls(text);
      if (blinkUrls.length > 0) {
        result.hasBlink = true;
        result.blinks = [];
        
        for (const url of blinkUrls) {
          const blinkInfo = await this.blinkExplorer.processBlink(url);
          if (blinkInfo) {
            result.blinks.push(blinkInfo);
          }
        }
      }
      
      return result;
    } catch (error) {
      this.callbacks.onError?.(error.message);
      return result;
    }
  }
  
  /**
   * Verifica si un texto contiene comandos sin procesarlos
   * @param {string} text - Texto a verificar
   * @returns {Object} - Información de lo que contiene
   */
  previewText(text) {
    const actionDetected = detectAction(text);
    const blinkUrls = detectBlinkUrls(text);
    
    return {
      hasCommand: !!actionDetected,
      hasBlink: blinkUrls.length > 0,
      actionType: actionDetected?.action || null,
      blinkCount: blinkUrls.length,
      suggestions: this.getSuggestions(text)
    };
  }
  
  /**
   * Obtiene sugerencias basadas en el texto parcial
   * @param {string} text - Texto parcial
   * @returns {Array} - Array de sugerencias
   */
  getSuggestions(text) {
    const suggestions = [];
    const lowerText = text.toLowerCase();
    
    // Sugerencias basadas en palabras clave
    if (lowerText.includes('envía') || lowerText.includes('send')) {
      suggestions.push('envía 5 SOL a [wallet]');
    }
    
    if (lowerText.includes('pide') || lowerText.includes('request')) {
      suggestions.push('pide 10 USDC por pizza');
    }
    
    if (lowerText.includes('compra') || lowerText.includes('buy')) {
      suggestions.push('compra 1 SOL de BONK');
    }
    
    return suggestions;
  }
}

/**
 * Hook para usar el parser en componentes React
 * @param {Object} context - Contexto del chat
 * @param {Object} callbacks - Callbacks para eventos
 * @returns {Object} - Funciones del parser
 */
export function useCommandParser(context = {}, callbacks = {}) {
  const [parser] = React.useState(() => new CommandParser());
  
  React.useEffect(() => {
    parser.initialize(callbacks);
  }, [parser, callbacks]);
  
  const processText = React.useCallback(
    (text) => parser.processText(text, context),
    [parser, context]
  );
  
  const previewText = React.useCallback(
    (text) => parser.previewText(text),
    [parser]
  );
  
  return {
    processText,
    previewText,
    parser
  };
}

/**
 * Utilidades para el parser
 */
export const ParserUtils = {
  /**
   * Limpia y normaliza texto de entrada
   * @param {string} text - Texto a limpiar
   * @returns {string} - Texto limpio
   */
  cleanText(text) {
    return text.trim().replace(/\s+/g, ' ');
  },
  
  /**
   * Extrae parámetros de un comando
   * @param {string} text - Texto del comando
   * @param {RegExp} pattern - Patrón regex
   * @returns {Object} - Parámetros extraídos
   */
  extractParams(text, pattern) {
    const match = text.match(pattern);
    if (!match) return null;
    
    return {
      fullMatch: match[0],
      groups: match.slice(1),
      index: match.index
    };
  },
  
  /**
   * Valida si un texto parece ser un comando
   * @param {string} text - Texto a validar
   * @returns {boolean} - True si parece ser un comando
   */
  looksLikeCommand(text) {
    const commandWords = [
      'envía', 'envia', 'manda', 'send', 'transferir', 'transfer',
      'pide', 'request', 'solicita', 'necesito', 'mándame', 'mandame',
      'compra', 'buy', 'comprar', 'quiero', 'want'
    ];
    
    const lowerText = text.toLowerCase();
    return commandWords.some(word => lowerText.includes(word));
  }
};




