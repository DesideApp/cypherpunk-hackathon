// src/middleware/telegramBotGuard.js
/**
 * Middleware simple basado en API key para el bot de Telegram.
 * Espera que el cliente envíe `X-Telegram-Admin-Token` con el valor
 * definido en TELEGRAM_BOT_ADMIN_TOKEN.
 */
export function telegramBotGuard(req, res, next) {
  const provided = req.headers['x-telegram-admin-token'];
  const expected = process.env.TELEGRAM_BOT_ADMIN_TOKEN;

  if (!expected) {
    return res.status(500).json({
      error: 'TELEGRAM_ADMIN_TOKEN_NOT_CONFIGURED',
      message: 'Missing TELEGRAM_BOT_ADMIN_TOKEN in environment variables.'
    });
  }

  if (typeof provided !== 'string' || provided !== expected) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  return next();
}

export default telegramBotGuard;
