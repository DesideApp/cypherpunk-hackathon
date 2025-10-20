// tests/shared/natural-commands.test.js
// Tests compartidos para validar migración

import { describe, test, expect } from 'vitest';
import { NaturalCommandParser } from '../../backend/src/shared/natural-commands/NaturalCommandParser.js';

describe('Natural Commands - Shared Tests', () => {
  let parser;
  
  beforeEach(() => {
    parser = new NaturalCommandParser();
  });

  test('Parser se inicializa correctamente', () => {
    expect(parser).toBeDefined();
    expect(parser.actions).toBeDefined();
    expect(Object.keys(parser.actions).length).toBeGreaterThan(0);
  });

  test('Detecta comandos de envío', () => {
    const testCases = [
      'envía 5 SOL',
      'manda 10 USDC',
      'send 2 USDT',
      'transfiere 0.5 SOL'
    ];
    
    testCases.forEach(testCase => {
      const result = parser.parse(testCase);
      expect(result).toBeDefined();
      expect(result.action).toBe('send');
      expect(result.params.amount).toBeDefined();
      expect(result.params.token).toBeDefined();
    });
  });

  test('Detecta comandos de solicitud', () => {
    const testCases = [
      'pídeme 5 SOL',
      'necesito 10 USDC',
      'request 2 USDT',
      'solicita 0.5 SOL'
    ];
    
    testCases.forEach(testCase => {
      const result = parser.parse(testCase);
      expect(result).toBeDefined();
      expect(result.action).toBe('request');
      expect(result.params.amount).toBeDefined();
      expect(result.params.token).toBeDefined();
    });
  });

  test('Detecta comandos de compra', () => {
    const testCases = [
      'compra 0.5 SOL',
      'buy 1 USDC',
      'adquiere 2 USDT',
      'quiero comprar 0.1 SOL'
    ];
    
    testCases.forEach(testCase => {
      const result = parser.parse(testCase);
      expect(result).toBeDefined();
      expect(result.action).toBe('buy');
      expect(result.params.amount).toBeDefined();
      expect(result.params.token).toBeDefined();
    });
  });

  test('Detecta comandos de intercambio', () => {
    const testCases = [
      'cambia 1 SOL a USDC',
      'swap 10 USDC to SOL',
      'convierte 5 USDT en SOL',
      'intercambia 2 SOL por USDC'
    ];
    
    testCases.forEach(testCase => {
      const result = parser.parse(testCase);
      expect(result).toBeDefined();
      expect(result.action).toBe('swap');
      expect(result.params.amount).toBeDefined();
      expect(result.params.fromToken).toBeDefined();
      expect(result.params.toToken).toBeDefined();
    });
  });

  test('Valida comandos correctamente', () => {
    const validCommand = parser.parse('envía 5 SOL');
    expect(validCommand).toBeDefined();
    
    const validation = parser.validateCommand(validCommand);
    expect(validation.valid).toBe(true);
  });

  test('Rechaza comandos inválidos', () => {
    const invalidCommand = {
      action: 'invalid',
      params: {}
    };
    
    const validation = parser.validateCommand(invalidCommand);
    expect(validation.valid).toBe(false);
    expect(validation.error).toBeDefined();
  });

  test('Genera preview correctamente', () => {
    const command = parser.parse('envía 5 SOL');
    const preview = parser.generatePreview(command);
    
    expect(preview).toContain('💳');
    expect(preview).toContain('Send');
    expect(preview).toContain('5');
    expect(preview).toContain('SOL');
  });

  test('Obtiene ejemplos correctamente', () => {
    const examples = parser.getExamples('send');
    expect(examples).toBeDefined();
    expect(Array.isArray(examples)).toBe(true);
    expect(examples.length).toBeGreaterThan(0);
  });

  test('Obtiene acciones disponibles', () => {
    const actions = parser.getAvailableActions();
    expect(actions).toBeDefined();
    expect(Array.isArray(actions)).toBe(true);
    expect(actions.length).toBeGreaterThan(0);
    
    const actionNames = actions.map(a => a.name);
    expect(actionNames).toContain('send');
    expect(actionNames).toContain('request');
    expect(actionNames).toContain('buy');
    expect(actionNames).toContain('swap');
  });

  test('Maneja casos edge correctamente', () => {
    // Comando vacío
    expect(parser.parse('')).toBeNull();
    expect(parser.parse(null)).toBeNull();
    expect(parser.parse(undefined)).toBeNull();
    
    // Comando no reconocido
    expect(parser.parse('comando no reconocido')).toBeNull();
    
    // Comando con formato incorrecto
    expect(parser.parse('envía')).toBeNull();
  });
});


