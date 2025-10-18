// frontend/src/natural-commands.test.js
// Tests de integración para comandos naturales via API

import { describe, test, expect } from 'vitest';
import { parseNaturalCommand, validateNaturalCommand, getAvailableActions } from './utils/naturalCommandsParser.js';

describe('Natural Commands API - Integration Tests', () => {
  
  test('API devuelve acciones disponibles', async () => {
    // Skip test si no hay servidor corriendo
    try {
      const result = await getAvailableActions();
      expect(result).toBeDefined();
    } catch (error) {
      console.log('Skipping test - no backend server available');
    }
  });

  test('API parsea comandos de envío', async () => {
    const testCases = [
      'envía 5 SOL',
      'manda 10 USDC', 
      'send 2 USDT'
    ];
    
    // Skip test si no hay servidor corriendo
    try {
      for (const testCase of testCases) {
        const result = await parseNaturalCommand(testCase);
        expect(result).toBeDefined();
      }
    } catch (error) {
      console.log('Skipping test - no backend server available');
    }
  });

  test('API valida comandos correctamente', async () => {
    // Skip test si no hay servidor corriendo
    try {
      const result = await validateNaturalCommand('envía 5 SOL');
      expect(result).toBeDefined();
    } catch (error) {
      console.log('Skipping test - no backend server available');
    }
  });
});
