#!/usr/bin/env node

// scripts/generate-intents.js
// Generador básico de intents desde ActionDefinitions

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class IntentGenerator {
  constructor() {
    this.rootDir = path.resolve(__dirname, '..');
    this.sharedDir = path.join(this.rootDir, 'src', 'shared', 'natural-commands');
    this.backendDir = path.join(this.rootDir, 'backend', 'src', 'modules', 'natural-commands');
    this.frontendDir = path.join(this.rootDir, 'frontend', 'src', 'utils');
  }

  async generateAll() {
    console.log('🔄 Generando intents desde ActionDefinitions...');
    
    try {
      // 1. Cargar definiciones
      const { default: actions } = await import(path.join(this.sharedDir, 'ActionDefinitions.js'));
      console.log(`📝 Cargadas ${actions.length} acciones`);
      
      // 2. Generar parser compartido
      await this.generateSharedParser(actions);
      
      // 3. Generar registry compartido
      await this.generateSharedRegistry(actions);
      
      // 4. Generar archivos específicos
      await this.generateBackendFiles();
      await this.generateFrontendFiles();
      
      console.log('✅ Intents generados exitosamente!');
      
    } catch (error) {
      console.error('❌ Error generando intents:', error.message);
      process.exit(1);
    }
  }

  async generateSharedParser(actions) {
    console.log('📝 Generando NaturalCommandParser compartido...');
    
    const content = `// 🤖 GENERADO AUTOMÁTICAMENTE - NO EDITAR MANUALMENTE
// Ejecuta: npm run generate-intents para regenerar

import { ActionDefinitions } from './ActionDefinitions.js';

export class NaturalCommandParser {
  constructor() {
    this.actions = this.loadActions();
  }

  loadActions() {
    const actions = {};
    
    ActionDefinitions.forEach(actionDef => {
      const patterns = this.generatePatterns(actionDef);
      
      actions[actionDef.key] = {
        patterns,
        handler: actionDef.handler,
        requiredParams: actionDef.patterns,
        description: actionDef.description,
        examples: actionDef.examples
      };
    });
    
    return actions;
  }

  generatePatterns(actionDef) {
    const patterns = [];
    const { verbs, patterns: paramPatterns } = actionDef;
    
    const patternMap = {
      amount: '(\\\\d+(?:\\\\.\\\\d+)?)',
      token: '(SOL|USDC|USDT|BONK|JUP)',
      recipient: '(?:a\\\\s+@?([a-zA-Z0-9_]+))?',
      fromToken: '(SOL|USDC|USDT|BONK|JUP)',
      toToken: '(?:a|to|en|por)\\\\s+(SOL|USDC|USDT|BONK|JUP)'
    };
    
    verbs.forEach(verb => {
      let regex = \`^\${verb}\\\\s+\`;
      
      paramPatterns.forEach((pattern, index) => {
        if (patternMap[pattern]) {
          regex += patternMap[pattern];
        }
        
        if (index < paramPatterns.length - 1) {
          regex += '\\\\s+';
        }
      });
      
      patterns.push(new RegExp(regex, 'i'));
    });
    
    return patterns;
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
    
    config.requiredParams.forEach((param, index) => {
      if (match[index + 1]) {
        command.params[param] = match[index + 1];
      }
    });
    
    this.extractOptionalParams(originalMessage, command, config);
    
    return command;
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
    const memoRegex = /(?:por|for|memo|nota|note):\\\\s*(.+?)(?:\\\\s|$)/i;
    const match = text.match(memoRegex);
    return match ? match[1].trim() : null;
  }

  validateCommand(command) {
    if (!command || !command.action) {
      return { valid: false, error: 'Invalid command structure' };
    }
    
    const config = this.actions[command.action];
    if (!config) {
      return { valid: false, error: \`Unknown action: \${command.action}\` };
    }
    
    for (const param of config.requiredParams) {
      if (!command.params[param]) {
        return { valid: false, error: \`Missing required parameter: \${param}\` };
      }
    }
    
    if (command.params.token && !this.isValidToken(command.params.token)) {
      return { valid: false, error: \`Invalid token: \${command.params.token}\` };
    }
    
    if (command.params.fromToken && !this.isValidToken(command.params.fromToken)) {
      return { valid: false, error: \`Invalid fromToken: \${command.params.fromToken}\` };
    }
    
    if (command.params.toToken && !this.isValidToken(command.params.toToken)) {
      return { valid: false, error: \`Invalid toToken: \${command.params.toToken}\` };
    }
    
    if (command.params.amount) {
      const amount = parseFloat(command.params.amount);
      if (isNaN(amount) || amount <= 0) {
        return { valid: false, error: \`Invalid amount: \${command.params.amount}\` };
      }
    }
    
    return { valid: true };
  }

  isValidToken(token) {
    const validTokens = ['SOL', 'USDC', 'USDT', 'BONK', 'JUP'];
    return validTokens.includes(token.toUpperCase());
  }

  generatePreview(command) {
    const { action, params } = command;
    
    switch (action) {
      case 'send':
        return \`💳 Send \${params.amount} \${params.token}\${params.recipient ? \` to \${params.recipient}\` : ''}\`;
      case 'request':
        return \`📋 Request \${params.amount} \${params.token}\`;
      case 'buy':
        return \`🛒 Buy \${params.amount} \${params.token}\`;
      case 'swap':
        return \`🔄 Swap \${params.amount} \${params.fromToken} to \${params.toToken}\`;
      default:
        return \`⚡ \${action} action\`;
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
}`;

    await fs.promises.writeFile(
      path.join(this.sharedDir, 'NaturalCommandParser.js'), 
      content
    );
  }

  async generateSharedRegistry(actions) {
    console.log('📝 Generando ActionRegistry compartido...');
    
    const content = `// 🤖 GENERADO AUTOMÁTICAMENTE - NO EDITAR MANUALMENTE
// Ejecuta: npm run generate-intents para regenerar

import { ActionDefinitions } from './ActionDefinitions.js';

export const ACTION_REGISTRY = {};

ActionDefinitions.forEach(actionDef => {
  const patterns = generatePatterns(actionDef);
  
  ACTION_REGISTRY[actionDef.key] = {
    patterns,
    handler: actionDef.handler,
    requiredParams: actionDef.patterns,
    optionalParams: ['recipient', 'memo'],
    description: actionDef.description
  };
});

function generatePatterns(actionDef) {
  const patterns = [];
  const { verbs, patterns: paramPatterns } = actionDef;
  
  const patternMap = {
    amount: '(\\\\d+(?:\\\\.\\\\d+)?)',
    token: '(SOL|USDC|USDT|BONK|JUP)',
    recipient: '(?:a\\\\s+@?([a-zA-Z0-9_]+))?',
    fromToken: '(SOL|USDC|USDT|BONK|JUP)',
    toToken: '(?:a|to|en|por)\\\\s+(SOL|USDC|USDT|BONK|JUP)'
  };
  
  verbs.forEach(verb => {
    let regex = \`^\${verb}\\\\s+\`;
    
    paramPatterns.forEach((pattern, index) => {
      if (patternMap[pattern]) {
        regex += patternMap[pattern];
      }
      
      if (index < paramPatterns.length - 1) {
        regex += '\\\\s+';
      }
    });
    
    patterns.push(new RegExp(regex, 'i'));
  });
  
  return patterns;
}

export function isValidToken(token) {
  const validTokens = ['SOL', 'USDC', 'USDT', 'BONK', 'JUP'];
  return validTokens.includes(token.toUpperCase());
}

export function extractMentions(text) {
  const mentionRegex = /@([a-zA-Z0-9_]+)/g;
  const mentions = [];
  let match;
  
  while ((match = mentionRegex.exec(text)) !== null) {
    mentions.push(match[1]);
  }
  
  return mentions;
}

export function extractMemo(text) {
  const memoRegex = /(?:por|for|memo|nota|note):\\\\s*(.+?)(?:\\\\s|$)/i;
  const match = text.match(memoRegex);
  return match ? match[1].trim() : null;
}`;

    await fs.promises.writeFile(
      path.join(this.sharedDir, 'ActionRegistry.js'), 
      content
    );
  }

  async generateBackendFiles() {
    console.log('📝 Generando archivos específicos del backend...');
    // Los archivos del backend ya están actualizados con imports
  }

  async generateFrontendFiles() {
    console.log('📝 Generando archivos específicos del frontend...');
    // Los archivos del frontend ya están actualizados con imports
  }
}

// Ejecutar generación
const generator = new IntentGenerator();
generator.generateAll().catch(console.error);


