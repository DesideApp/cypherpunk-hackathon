// src/modules/telegram-bot/telegramBot.js
// Bot de Telegram para comandos naturales de acciones

import { Telegraf } from 'telegraf';
import logger from '../../../config/logger.js';
import { env } from '#config/env.js';
// import { detectAction, processAction } from '../../natural-commands/actions-registry.js';
// import pkg from '../../../../../frontend/src/features/messaging/actions/blinkUrlBuilder.js';
// const { buildTransfer, buildRequest } = pkg;
// import { validateAmount, isSupportedToken } from '../../../shared/tokens/tokens.js';
import { calculateFee, addFeeToAction } from '../services/feeSystem.service.js';
import { buildTransferBlink, buildRequestBlink, buildBuyBlink } from '../services/dialTo.service.js';
import { listTokens, getToken } from '../services/tokenCatalog.service.js';

const SUPPORTED_TOKENS = ['sol', 'usdc', 'usdt'];
const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const REQUEST_PATTERNS = [
  /^(?:env[ií]ame|env[ií]enme|mandame|m[aá]ndame|pide|solicita|necesito|send me|request)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?(?:\s+(?:por|for)\s+(.+))?/i,
  /^(?:quiero\s+(?:recibir|que me paguen)|i need|ask for)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?(?:\s+(?:por|for)\s+(.+))?/i
];

const SEND_PATTERNS = [
  /^(?:env[ií]a|manda|m[aá]nda|transfiere|send|transfer)\s+(\d+(?:\.\d+)?)\s*(sol|usdc|usdt)?\s+(?:a|to)\s+([1-9A-HJ-NP-Za-km-z]{32,44})(?:\s+(?:por|for)\s+(.+))?/i
];

const BUY_PATTERNS = [
  /^(?:compra|cómprame|quiero comprar|quiero|buy)\s+(\d+(?:\.\d+)?)\s*([a-z0-9]+)(?:\s+(?:con|using)\s+([a-z0-9]+))?/i,
];

function validateAmount(amount) {
  const num = parseFloat(amount);
  return !Number.isNaN(num) && num > 0;
}

function isSupportedToken(token = '') {
  return SUPPORTED_TOKENS.includes(token.toLowerCase());
}

function detectAction(text) {
  if (!text || typeof text !== 'string') {
    return null;
  }

  const message = text.trim();

  for (const pattern of SEND_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return {
        type: 'send',
        amount: match[1],
        token: match[2] || 'sol',
        to: match[3],
        memo: match[4] || null
      };
    }
  }

  for (const pattern of REQUEST_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return {
        type: 'request',
        amount: match[1],
        token: match[2] || 'sol',
        memo: match[3] || null
      };
    }
  }

  for (const pattern of BUY_PATTERNS) {
    const match = message.match(pattern);
    if (match) {
      return {
        type: 'buy',
        amount: match[1],
        token: match[2],
        payWith: match[3] || null,
      };
    }
  }

  return null;
}

async function processAction(text, context) {
  const detectedAction = detectAction(text);

  if (!detectedAction) {
    return {
      success: false,
      error: 'No se pudo detectar la acción'
    };
  }

  if (!validateAmount(detectedAction.amount)) {
    return {
      success: false,
      error: 'Cantidad inválida'
    };
  }

  if (!isSupportedToken(detectedAction.token)) {
    return {
      success: false,
      error: 'Token no soportado'
    };
  }

  const normalizedToken = detectedAction.token.toUpperCase();
  const tokenForUrl = normalizedToken.toLowerCase();

  switch (detectedAction.type) {
    case 'request': {
      if (!context.myWallet) {
        return {
          success: false,
          error: 'Configura tu wallet primero con /wallet [tu_direccion]'
        };
      }

      const requestBlink = buildRequestBlink({
        token: tokenForUrl,
        to: context.myWallet,
        amount: detectedAction.amount,
        memo: detectedAction.memo
      });

      logger.info(`🔗 [telegram-bot] Generated request URL: ${requestBlink.actionUrl}`);

      return {
        success: true,
        action: detectedAction.type,
        result: {
          ...requestBlink,
          token: normalizedToken
        },
        blink: requestBlink
      };
    }

    case 'send': {
      if (!detectedAction.to || !BASE58_RE.test(detectedAction.to)) {
        return {
          success: false,
          error: 'Debes indicar una wallet válida'
        };
      }

      const transferBlink = buildTransferBlink({
        token: tokenForUrl,
        to: detectedAction.to,
        amount: detectedAction.amount,
        memo: detectedAction.memo
      });

      logger.info(`🔗 [telegram-bot] Generated transfer URL: ${transferBlink.actionUrl}`);

      return {
        success: true,
        action: detectedAction.type,
        result: {
          ...transferBlink,
          token: normalizedToken
        },
        blink: transferBlink
      };
    }

    case 'buy': {
      const tokenMeta = await getToken(detectedAction.token);
      if (!tokenMeta) {
        return {
          success: false,
          error: `Token no soportado: ${detectedAction.token}`
        };
      }

      let buyBlink;
      try {
        buyBlink = buildBuyBlink({
          token: tokenMeta.symbol,
          amount: detectedAction.amount,
        });
      } catch (error) {
        logger.warn('⚠️ [telegram-bot] Buy blink generation failed', {
          error: error.message
        });
        return {
          success: false,
          error: error.message
        };
      }

      logger.info(`🛒 [telegram-bot] Generated buy URL: ${buyBlink.actionUrl}`, {
        token: tokenMeta.symbol,
        amount: detectedAction.amount,
      });

      return {
        success: true,
        action: detectedAction.type,
        result: {
          ...buyBlink,
          token: tokenMeta.symbol,
          targetToken: tokenMeta.symbol,
        },
        blink: buyBlink
      };
    }

    default:
      return {
        success: false,
        error: 'Acción no soportada aún'
      };
  }
}

class TelegramBot {
  constructor() {
    this.bot = null;
    this.isRunning = false;
    this.userSessions = new Map(); // Almacena sesiones de usuarios
    this.userLanguages = new Map(); // Almacena idiomas de usuarios
    this.botUsername = null;
    this.botId = null;
    this.allowGroupAmbientMessages =
      Boolean(env.TELEGRAM_ALLOW_GROUP_MESSAGES) ||
      process.env.TELEGRAM_ALLOW_GROUP_MESSAGES === 'true' ||
      process.env.TELEGRAM_ALLOW_GROUP_MESSAGES === '1';
  }

  /**
   * Inicializa el bot de Telegram
   */
  async initialize() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new Error('TELEGRAM_BOT_TOKEN environment variable is required');
    }

    this.bot = new Telegraf(token);
    await this.setupBotIdentity();
    this.setupHandlers();
    
    logger.info('🤖 [telegram-bot] Bot initialized successfully');
  }

  /**
   * Configura los handlers del bot
   */
  setupHandlers() {
    // Comando de inicio - Selección de idioma
    this.bot.start((ctx) => {
      const welcomeMessage = `🚀 *Welcome to Blink Actions!*

Please select your language / Por favor selecciona tu idioma:`;
      
      ctx.reply(welcomeMessage, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🇺🇸 English', callback_data: 'lang_en' }],
            [{ text: '🇪🇸 Español', callback_data: 'lang_es' }]
          ]
        }
      });
    });


    // Comando para cambiar idioma
    this.bot.command('language', (ctx) => {
      const langMessage = `Select your language / Selecciona tu idioma:`;
      
      ctx.reply(langMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🇺🇸 English', callback_data: 'lang_en' }],
            [{ text: '🇪🇸 Español', callback_data: 'lang_es' }]
          ]
        }
      });
    });

    // Comando para configurar wallet
    this.bot.command('wallet', (ctx) => {
      const args = ctx.message.text.split(' ').slice(1);
      if (args.length === 0) {
        const userLang = this.getUserLanguage(ctx.from.id);
        const message = userLang === 'es' 
          ? '❌ Usa: /wallet [tu_wallet_address]'
          : '❌ Use: /wallet [your_wallet_address]';
        ctx.reply(message);
        return;
      }

      const walletAddress = args[0];
      if (!this.isValidWalletAddress(walletAddress)) {
        const userLang = this.getUserLanguage(ctx.from.id);
        const message = userLang === 'es' 
          ? '❌ Dirección de wallet inválida'
          : '❌ Invalid wallet address';
        ctx.reply(message);
        return;
      }

      this.setUserWallet(ctx.from.id, walletAddress);
      const userLang = this.getUserLanguage(ctx.from.id);
      const message = userLang === 'es' 
        ? `✅ Wallet configurada: \`${walletAddress}\``
        : `✅ Wallet configured: \`${walletAddress}\``;
      
      ctx.reply(message, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📋 Copiar Wallet', callback_data: `copy_wallet_${walletAddress}` }]
          ]
        }
      });
    });

    // Comando para listar tokens disponibles
    this.bot.command('tokens', async (ctx) => {
      await this.handleTokensCommand(ctx);
    });

    // Handler para mensajes de texto (comandos naturales)
    this.bot.on('text', async (ctx) => {
      try {
        // En grupos, procesar si el bot es mencionado o es un chat privado
        const isPrivateChat = ctx.chat.type === 'private';
        const isMentioned = this.isBotMentioned(ctx);
        const isCommandForBot = this.isCommandDirectedToBot(ctx);
        const isReplyToBot = this.isReplyToBot(ctx);
        const allowAmbientGroup =
          this.allowGroupAmbientMessages &&
          (ctx.chat.type === 'group' || ctx.chat.type === 'supergroup');
        
        logger.info(
          `🔍 [telegram-bot] Message in ${ctx.chat.type}: "${ctx.message.text}" - Private: ${isPrivateChat}, Mentioned: ${isMentioned}, CommandForBot: ${isCommandForBot}, ReplyToBot: ${isReplyToBot}, AmbientAllowed: ${allowAmbientGroup}`
        );
        
        // Procesar en chats privados o cuando se menciona al bot en grupos
        if (isPrivateChat || isMentioned || isCommandForBot || isReplyToBot || allowAmbientGroup) {
          const commandTrigger = (ctx.message.text || '').split(/\s+/)[0] || '';
          if (commandTrigger.startsWith('/tokens')) {
            await this.handleTokensCommand(ctx);
            return;
          }
          await this.handleNaturalCommand(ctx);
        }
      } catch (error) {
        logger.error('❌ [telegram-bot] Error handling message', {
          userId: ctx.from.id,
          message: ctx.message.text,
          error: error.message
        });
        
        const userLang = this.getUserLanguage(ctx.from.id);
        const errorMessage = userLang === 'es' 
          ? '❌ Ocurrió un error procesando tu comando. Inténtalo de nuevo.'
          : '❌ An error occurred processing your command. Please try again.';
        
        ctx.reply(errorMessage);
      }
    });

    // Handlers para botones de idioma
    this.bot.action('lang_en', (ctx) => {
      this.setUserLanguage(ctx.from.id, 'en');
      const welcomeMessageEN = `🚀 *Welcome to Blink Actions!*

I help you request tokens with natural commands.

💰 *Available commands:*
• \`send me 5 SOL for pizza\`
• \`request 10 USDC\`
• \`buy 1 JUP\`

🚀 *How it works:*
1. Write your command
2. Share the link I give you
3. Someone clicks and pays you
4. You receive the tokens!

⚙️ *Setup:*
• Use /wallet to set your address (where you receive tokens)
• Use /tokens to see supported assets
• Use /language to change language

💡 *Example:*
Write: "send me 1 SOL for lunch"
I'll give you a link to share with friends!`;

      ctx.editMessageText(welcomeMessageEN, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Change Language', callback_data: 'change_lang' }]
          ]
        }
      });
    });

    this.bot.action('lang_es', (ctx) => {
      this.setUserLanguage(ctx.from.id, 'es');
      const welcomeMessageES = `🚀 *¡Bienvenido a Blink Actions!*

Te ayudo a solicitar tokens con comandos naturales.

💰 *Comandos disponibles:*
• \`envíame 5 SOL por pizza\`
• \`mándame 10 USDC\`
• \`compra 1 JUP\`

🚀 *Cómo funciona:*
1. Escribe tu comando
2. Comparte el enlace que te doy
3. Alguien hace clic y te paga
4. ¡Recibes los tokens!

⚙️ *Configuración:*
• Usa /wallet para configurar tu dirección (donde recibes tokens)
• Usa /tokens para ver los activos soportados
• Usa /language para cambiar idioma

💡 *Ejemplo:*
Escribe: "envíame 1 SOL por el almuerzo"
¡Te daré un enlace para compartir con amigos!`;

      ctx.editMessageText(welcomeMessageES, { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Cambiar Idioma', callback_data: 'change_lang' }]
          ]
        }
      });
    });

    // Handler para cambiar idioma
    this.bot.action('change_lang', (ctx) => {
      const langMessage = `Select your language / Selecciona tu idioma:`;
      
      ctx.editMessageText(langMessage, {
        reply_markup: {
          inline_keyboard: [
            [{ text: '🇺🇸 English', callback_data: 'lang_en' }],
            [{ text: '🇪🇸 Español', callback_data: 'lang_es' }]
          ]
        }
      });
    });

    // Handler para copiar wallet
    this.bot.action(/^copy_wallet_(.+)$/, (ctx) => {
      const walletAddress = ctx.match[1];
      const userLang = this.getUserLanguage(ctx.from.id);
      const message = userLang === 'es' 
        ? `📋 Wallet copiada: \`${walletAddress}\``
        : `📋 Wallet copied: \`${walletAddress}\``;
      
      ctx.answerCbQuery(message, { show_alert: true });
    });

    // Handler para errores
    this.bot.catch((err, ctx) => {
      logger.error('❌ [telegram-bot] Bot error', {
        userId: ctx.from?.id,
        error: err.message
      });
    });
  }

  /**
   * Obtiene información del bot (username e ID)
   */
  async setupBotIdentity() {
    try {
      const botInfo = await this.bot.telegram.getMe();
      this.botUsername = botInfo.username ? botInfo.username.toLowerCase() : null;
      this.botId = botInfo.id || null;
      
      logger.info('🆔 [telegram-bot] Bot identity loaded', {
        username: this.botUsername,
        botId: this.botId
      });
    } catch (error) {
      logger.warn('⚠️ [telegram-bot] Failed to load bot identity', {
        error: error.message
      });
    }
  }

  /**
   * Maneja comandos naturales de texto
   */
  async handleNaturalCommand(ctx) {
    const originalText = ctx.message.text || '';
    const normalizedText = this.normalizeMessage(originalText);
    const userId = ctx.from.id;
    
    logger.info('📨 [telegram-bot] Processing message', {
      userId,
      username: ctx.from.username,
      originalText,
      normalizedText
    });

    // Detectar si es un comando de acción
    const detected = detectAction(normalizedText);
    if (!detected) {
      // Si no es un comando de acción, responder con ayuda
      const userLang = this.getUserLanguage(userId);
      const helpMessage = userLang === 'es' 
        ? '❓ No entendí tu comando. Escribe algo como: "envíame 5 SOL por pizza"'
        : '❓ I didn\'t understand your command. Try writing: "send me 5 SOL for pizza"';
      
      ctx.reply(helpMessage);
      return;
    }

    // Obtener contexto del usuario
    const userSession = this.getUserSession(userId);
    const context = {
      myWallet: userSession.wallet,
      peerWallet: null, // En Telegram no hay "contacto seleccionado"
      memo: null
    };

    // Procesar la acción
    logger.info(`🔍 [telegram-bot] Processing action: ${normalizedText}`);
    const result = await processAction(normalizedText, context);
    logger.info(`🔍 [telegram-bot] Action result:`, result);
    
    if (!result.success) {
      ctx.reply(`❌ Error: ${result.error || 'Unknown error'}`);
      return;
    }

    // Responder según el tipo de acción
    await this.handleActionResult(ctx, result);
  }

  /**
   * Maneja el resultado de una acción
   */
  async handleActionResult(ctx, result) {
    const { action, result: actionResult } = result;

    // Calcular fee para la acción
    let feeInfo = null;
    try {
      feeInfo = calculateFee({
        token: actionResult.token,
        amount: parseFloat(actionResult.amount),
        type: action
      });
      
      // Añadir fee a la acción
      const actionWithFee = addFeeToAction(actionResult, feeInfo);
      
      switch (action) {
        case 'request':
          await this.handleRequestAction(ctx, actionWithFee, feeInfo);
          break;
        case 'send':
          await this.handleSendAction(ctx, actionWithFee, feeInfo);
          break;
        case 'buy':
          await this.handleBuyAction(ctx, actionWithFee, feeInfo);
          break;
        default:
          ctx.reply(`❌ Acción no soportada aún: ${action}`);
      }
      
    } catch (error) {
      logger.error('❌ [telegram-bot] Error processing fee', {
        userId: ctx.from.id,
        action,
        error: error.message
      });
      
      // Si hay error con el fee, procesar sin fee
      switch (action) {
        case 'request':
          await this.handleRequestAction(ctx, actionResult, null);
          break;
        case 'send':
          await this.handleSendAction(ctx, actionResult, null);
          break;
        case 'buy':
          await this.handleBuyAction(ctx, actionResult, null);
          break;
        default:
          ctx.reply(`❌ Acción no soportada aún: ${action}`);
      }
    }
  }

  /**
   * Maneja acción de envío
   */
  async handleSendAction(ctx, actionResult, feeInfo) {
    const { token, amount, to, dialToUrl } = actionResult;
    
    let message = `
✅ *Acción de envío creada*

💰 *Detalles:*
• Token: ${token}
• Cantidad: ${amount}
• Destinatario: \`${to}\`
`;

    // Añadir información del fee si existe
    if (feeInfo) {
      message += `
💸 *Fee:* ${feeInfo.amount} ${feeInfo.token}
`;
    }

    message += `
🔗 *Enlace de acción:* [Hacer transferencia](${dialToUrl})

💡 *Instrucciones:*
1. Haz clic en el enlace de arriba
2. Confirma la transacción en tu wallet
3. La transferencia se completará automáticamente
    `;

    ctx.reply(message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  }

  /**
   * Maneja acción de solicitud
   */
  async handleRequestAction(ctx, actionResult, feeInfo) {
    const { token, amount, dialToUrl, memo } = actionResult;
    const userLang = this.getUserLanguage(ctx.from.id);
    
    if (userLang === 'es') {
      let message = `
✅ *Solicitud creada*

💰 *Detalles:*
• Token: ${token}
• Cantidad: ${amount}
`;

      // Añadir motivo si existe
      if (memo) {
        message += `• Motivo: ${memo}
`;
      }

      // Añadir información del fee si existe
      if (feeInfo) {
        message += `• Fee: ${feeInfo.amount} ${feeInfo.token}
`;
      }

      message += `
🔗 *Enlace:* [Hacer pago](${dialToUrl})

🚀 *Cómo usar:*
1. Comparte este enlace con quien quieres que te pague
2. Ellos harán clic y completarán el pago
3. ¡Recibirás los tokens automáticamente!

💡 *Tip:* Puedes compartir el enlace en grupos, chats o redes sociales
      `;

      ctx.reply(message, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    } else {
      let message = `
✅ *Request created*

💰 *Details:*
• Token: ${token}
• Amount: ${amount}
`;

      // Añadir motivo si existe
      if (memo) {
        message += `• Reason: ${memo}
`;
      }

      // Añadir información del fee si existe
      if (feeInfo) {
        message += `• Fee: ${feeInfo.amount} ${feeInfo.token}
`;
      }

      message += `
🔗 *Link:* [Make payment](${dialToUrl})

🚀 *How to use:*
1. Share this link with who you want to pay you
2. They will click and complete the payment
3. You will receive the tokens automatically!

💡 *Tip:* You can share the link in groups, chats or social networks
      `;

      ctx.reply(message, { 
        parse_mode: 'Markdown',
        disable_web_page_preview: true
      });
    }
  }

  /**
   * Maneja acción de compra
   */
  async handleBuyAction(ctx, actionResult, feeInfo) {
    let message = `
🛒 *Acción de compra creada*

💰 *Detalles:*
• Token: ${actionResult.token}
• Cantidad: ${actionResult.amount}
`;

    // Añadir información del fee si existe
    if (feeInfo) {
      message += `• Fee: ${feeInfo.amount} ${feeInfo.token}
`;
    }

    message += `
🔗 *Enlace de compra:* [Comprar tokens](${actionResult.dialToUrl})

💡 *Instrucciones:*
1. Haz clic en el enlace de arriba
2. Confirma la compra en tu wallet
3. Los tokens se añadirán a tu wallet
    `;

    ctx.reply(message, { 
      parse_mode: 'Markdown',
      disable_web_page_preview: true
    });
  }

  async handleTokensCommand(ctx) {
    const tokens = await listTokens();
    if (!Array.isArray(tokens) || tokens.length === 0) {
      await ctx.reply('❌ No hay tokens configurados todavía. Pide a un administrador que añada TELEGRAM_TOKEN_LIST.');
      return;
    }
    const messageLines = tokens.map((token) => `• ${token.symbol} - ${token.name || token.symbol}`);
    const helpText = `
🪙 *Tokens disponibles*

${messageLines.join('\n')}

💡 Ejemplos:
• \`buy 1 ${tokens[1]?.symbol || 'USDC'}\`
• \`compra 5 ${tokens[2]?.symbol || 'JUP'}\`
    `;

    await ctx.reply(helpText.trim(), {
      parse_mode: 'Markdown'
    });
  }

  /**
   * Normaliza el mensaje para el parser (quita / y menciones al bot)
   */
  normalizeMessage(text) {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let normalized = text.trim();

    // Eliminar mención directa al bot al inicio
    if (this.botUsername) {
      const leadingMentionRegex = new RegExp(`^@${this.botUsername}\\b`, 'i');
      normalized = normalized.replace(leadingMentionRegex, '').trim();

      const mentionRegexGlobal = new RegExp(`@${this.botUsername}\\b`, 'ig');
      normalized = normalized.replace(mentionRegexGlobal, '').trim();
    }

    // Eliminar comandos tipo /accion o /accion@bot
    if (normalized.startsWith('/')) {
      const parts = normalized.split(/\s+/);
      const commandToken = parts.shift();
      const command = commandToken
        .replace(/^\/+/g, '') // Quitar prefijo "/"
        .replace(/@.+$/g, ''); // Quitar @bot si existe
      normalized = [command, ...parts].join(' ').trim();
    }

    return normalized.replace(/\s{2,}/g, ' ').trim();
  }

  /**
   * Determina si el mensaje es una respuesta al bot
   */
  isReplyToBot(ctx) {
    try {
      const replyUserId = ctx.message?.reply_to_message?.from?.id;
      return Boolean(replyUserId && this.botId && replyUserId === this.botId);
    } catch {
      return false;
    }
  }

  /**
   * Determina si el mensaje es un comando directo al bot
   */
  isCommandDirectedToBot(ctx) {
    try {
      const entities = ctx.message?.entities;
      const text = ctx.message?.text || '';
      if (!entities || entities.length === 0) {
        return false;
      }

      return entities.some((entity) => {
        if (entity.type !== 'bot_command') {
          return false;
        }
        
        const commandText = text.substring(entity.offset, entity.offset + entity.length);
        if (!commandText) {
          return false;
        }

        const lowerCommand = commandText.toLowerCase();
        if (!lowerCommand.includes('@')) {
          return true; // Comando sin especificar bot llega al bot actual
        }

        return this.botUsername ? lowerCommand.includes(`@${this.botUsername}`) : false;
      });
    } catch (error) {
      logger.warn('⚠️ [telegram-bot] Failed to evaluate command entity', {
        error: error.message
      });
      return false;
    }
  }

  /**
   * Determina si el bot fue mencionado en el mensaje
   */
  isBotMentioned(ctx) {
    const text = ctx.message?.text || '';
    const lowerText = text.toLowerCase();

    if (this.botUsername && lowerText.includes(`@${this.botUsername}`)) {
      return true;
    }

    const entities = ctx.message?.entities;
    if (!entities || entities.length === 0) {
      return false;
    }

    return entities.some((entity) => {
      const value = text.substring(entity.offset, entity.offset + entity.length);

      if (entity.type === 'mention') {
        if (this.botUsername && value?.toLowerCase() === `@${this.botUsername}`) {
          return true;
        }
        return false;
      }

      if (entity.type === 'text_mention') {
        return Boolean(this.botId && entity.user?.id === this.botId);
      }

      return false;
    });
  }

  /**
   * Valida una dirección de wallet
   */
  isValidWalletAddress(address) {
    return BASE58_RE.test(address);
  }

  /**
   * Obtiene la sesión de un usuario
   */
  getUserSession(userId) {
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, {
        wallet: null,
        createdAt: Date.now()
      });
    }
    return this.userSessions.get(userId);
  }

  /**
   * Configura la wallet de un usuario
   */
  setUserWallet(userId, walletAddress) {
    const session = this.getUserSession(userId);
    session.wallet = walletAddress;
    this.userSessions.set(userId, session);
  }

  /**
   * Obtiene el idioma de un usuario
   */
  getUserLanguage(userId) {
    return this.userLanguages.get(userId) || 'en'; // Default: inglés
  }

  /**
   * Configura el idioma de un usuario
   */
  setUserLanguage(userId, language) {
    this.userLanguages.set(userId, language);
  }

  /**
   * Inicia el bot
   */
  async start() {
    if (this.isRunning) {
      logger.warn('⚠️ [telegram-bot] Bot is already running');
      return;
    }

    try {
      logger.info('🔄 [telegram-bot] Launching bot...');
      await this.bot.launch();
      this.isRunning = true;
      
      logger.info('🚀 [telegram-bot] Bot started successfully');
      
      // Graceful stop
      process.once('SIGINT', () => this.stop());
      process.once('SIGTERM', () => this.stop());
      
    } catch (error) {
      logger.error('❌ [telegram-bot] Failed to start bot', {
        error: error.message,
        stack: error.stack
      });
      console.error('Full bot start error:', error);
      throw error;
    }
  }

  /**
   * Detiene el bot
   */
  async stop() {
    if (!this.isRunning) {
      return;
    }

    try {
      this.bot.stop();
      this.isRunning = false;
      
      logger.info('🛑 [telegram-bot] Bot stopped successfully');
    } catch (error) {
      logger.error('❌ [telegram-bot] Error stopping bot', {
        error: error.message
      });
    }
  }

  /**
   * Obtiene estadísticas del bot
   */
  getStats() {
    return {
      isRunning: this.isRunning,
      activeUsers: this.userSessions.size,
      totalSessions: this.userSessions.size
    };
  }
}

export default TelegramBot;
