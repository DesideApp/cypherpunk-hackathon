// src/apps/api/v1/router.js
import { Router } from 'express';

import { protectRoute }   from '#middleware/authMiddleware.js';

// Routers modulares
import authRoutes         from '#modules/auth/routes/index.js';
import contactRoutes      from '#modules/contacts/routes/index.js';
import userRoutes         from '#modules/users/routes/index.js';
import signalRoutes       from '#modules/signal/routes/index.js';
import relayRoutes        from '#modules/relay/routes/index.js';
import dmRoutes           from '#modules/dm/routes/index.js';
import rtcRoutes          from '#modules/rtc/routes/index.js';
import blinkRoutes        from '#modules/blinks/routes/index.js';
import blinkPublicRoutes  from '#modules/blinks/routes/public.js';
import agreementRoutes    from '#modules/agreements/routes/index.js';
import statsRoutes        from '#modules/stats/routes/index.js';
import tokenRoutes        from '#modules/tokens/routes/index.js';
import naturalCommandsRoutes from '#modules/natural-commands/routes/index.js';
import telegramBotRoutes  from '../../../modules/telegram-bot/routes/index.js';
import linkPreviewRoutes  from '#modules/link-preview/routes/index.js';
import activityRoutes     from '#modules/activity/routes/index.js';

const v1 = Router();

/** ====== Públicas ====== */
v1.use('/auth',   authRoutes);
v1.use('/users',  userRoutes);
v1.use('/tokens', tokenRoutes);
v1.use('/natural-commands', naturalCommandsRoutes);

/** ====== Privadas (requieren JWT) ====== */
v1.use('/contacts', protectRoute, contactRoutes);
v1.use('/signal',   protectRoute, signalRoutes);
v1.use('/relay',    protectRoute, relayRoutes);
v1.use('/dm',       protectRoute, dmRoutes);
v1.use('/blinks',   protectRoute, blinkRoutes);
v1.use('/agreements', protectRoute, agreementRoutes);
v1.use('/activity', protectRoute, activityRoutes);
// RTC: privada dentro del módulo (protectRoute en la ruta)
v1.use('/rtc', rtcRoutes);

// Stats overview (temporalmente público)
v1.use('/stats', statsRoutes);

// Public blink endpoints for Dialect integrations (no JWT required)
v1.use('/blinks-public', blinkPublicRoutes);

// Telegram Bot endpoints (admin only)
v1.use('/telegram-bot', telegramBotRoutes);

// Link Preview endpoints (public)
v1.use('/link-preview', linkPreviewRoutes);

export default v1;
