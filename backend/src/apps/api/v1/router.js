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
import agreementRoutes    from '#modules/agreements/routes/index.js';

const v1 = Router();

/** ====== Públicas ====== */
v1.use('/auth',   authRoutes);
v1.use('/users',  userRoutes);

/** ====== Privadas (requieren JWT) ====== */
v1.use('/contacts', protectRoute, contactRoutes);
v1.use('/signal',   protectRoute, signalRoutes);
v1.use('/relay',    protectRoute, relayRoutes);
v1.use('/dm',       protectRoute, dmRoutes);
v1.use('/blinks',   protectRoute, blinkRoutes);
v1.use('/agreements', protectRoute, agreementRoutes);
// RTC: privada dentro del módulo (protectRoute en la ruta)
v1.use('/rtc', rtcRoutes);

export default v1;
