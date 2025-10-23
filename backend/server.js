// server.js
import express from 'express';
import mongoose from 'mongoose';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';

// ── Middlewares transversales
import { detectCountry } from '#middleware/geoMiddleware.js';

// ── Config / validación (carga .env dentro)
import logger from '#config/logger.js';
import { env } from '#config/env.js';         // valida/envía defaults al cargar
import config from '#config/appConfig.js';    // configuración central (tiers, etc.)

// ── Apps (bordes/adapters)
import { mountApi } from '#apps/api/index.js';           // monta /api (v1, v1_1...)
// import createWsServer from '#apps/ws/index.js';      // crea HTTP server + socket.io - TODO: implementar
// import { startWorkers } from '#apps/worker/index.js';// arranca cron/colas (no-op si no hay) - TODO: implementar

// Temporary WebSocket import (original implementation)
import createWebSocketServer from '#shared/services/websocketServer.js';

// 🗓️ Jobs/cron (Solana status/TPS/price y limpieza relay)
import '#jobs/eventScheduler.js';

// ── Utils
import { loadAppInfo } from '#utils/appInfo.js';
import { assertNoStubInProd } from '#utils/stubGuard.js';

// ── Logs (para eventos de proceso)

// ───────────────────────────────────────────────────────────────────────────────

const app       = express();
const PORT = Number(process.env.PORT) || 5000; // Render inyecta PORT; úsalo siempre
const NODE_ENV  = env.NODE_ENV || 'development';
const MONGO_URI = env.MONGO_URI;
const DATA_MODE = process.env.DATA_MODE || '';

let memServer = null;

app.set('trust proxy', 1);

// ALLOWED_ORIGINS: config.allowedOrigins > env.ALLOWED_ORIGINS > localhost
const envAllowed = (env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

const DEFAULT_DEV_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:5173'
];

const ALLOWED_ORIGINS = Array.isArray(config.allowedOrigins) && config.allowedOrigins.length
  ? config.allowedOrigins
  : (envAllowed.length ? envAllowed : DEFAULT_DEV_ORIGINS);

const corsLogTimestamps = new Map();
const CORS_LOG_TTL_MS = Math.max(Number(process.env.CORS_LOG_TTL_MS ?? 30000) || 0, 1000);

function applyCorsHeaders(res, origin) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin)
    ? origin
    : (ALLOWED_ORIGINS[0] || '*');
  res.header('Access-Control-Allow-Origin', allowed);
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Vary', 'Origin');
}

// Límite JSON: env.JSON_BODY_LIMIT_MB → bytes (fallback 6MB)
const limitMB = Number(env.JSON_BODY_LIMIT_MB ?? 6);
const jsonLimitBytes = Number.isFinite(limitMB) ? Math.floor(limitMB * 1024 * 1024) : 6 * 1024 * 1024;

logger.info(`🛠️ Mode: ${NODE_ENV}`);
logger.info(`🔗 Mongo URI: ${MONGO_URI ? "✅ set" : DATA_MODE === 'memory' ? 'ℹ️ in-memory mode' : "❌ missing"}`);
logger.info(`🎯 ALLOWED_ORIGINS: ${ALLOWED_ORIGINS.join(', ')}`);
logger.info(`📨 JSON_BODY_LIMIT_MB: ${limitMB}`);
logger.info(`⏳ RELAY_TTL_SECONDS (global safety): ${String(config.relayGlobalTtlSeconds ?? '')}`);

// Suprimir warnings específicos que pueden interferir con el proceso
process.removeAllListeners('warning');
process.on('warning', (warning) => {
  if (warning.name === 'DeprecationWarning' || 
      warning.message?.includes('Duplicate schema index') ||
      warning.message?.includes('punycode')) {
    // Ignorar warnings conocidos que no afectan funcionamiento
    return;
  }
  console.warn(warning);
});

// ───────────────────────────────────────────────────────────────────────────────
// Startup ordenado
// 1) Conecta Mongo
// 2) Middleware base
// 3) Monta /api (apps/api)
// 4) Arranca WS (apps/ws) → devuelve HTTP server
// 5) Arranca workers (apps/worker)
// 6) Health, 404, manejadores globales
// ───────────────────────────────────────────────────────────────────────────────

const startServer = async () => {
  try {
    // Bloquea stubs en producción salvo opt-in explícito
    assertNoStubInProd();
    // 1) MongoDB
    logger.info('🔌 Connecting to MongoDB...');
    const mongooseOpts = {
      ...(env.MONGO_DB_NAME ? { dbName: env.MONGO_DB_NAME } : {}),
      autoIndex: NODE_ENV !== 'production'
    };

    let mongoUri = MONGO_URI;
    if (!mongoUri) {
      if (DATA_MODE === 'memory') {
        const { MongoMemoryServer } = await import('mongodb-memory-server');
        memServer = await MongoMemoryServer.create();
        mongoUri = memServer.getUri();
        logger.warn(`🧪 DATA_MODE=memory → using in-memory MongoDB at ${mongoUri}`);
      } else {
        logger.error('❌ MONGO_URI is not set. Exiting...');
        process.exit(1);
      }
    }

    // Suprimir warnings de Mongoose que pueden causar problemas
    mongoose.set('strictQuery', false);

    await mongoose.connect(mongoUri, mongooseOpts);
    logger.info('✅ MongoDB connected');

    logger.info('⚙️ Setting up middleware...');
    // 2) Middlewares
    app.use(
      helmet({
        contentSecurityPolicy: false,
        hsts: { maxAge: 63072000, includeSubDomains: true, preload: true }
      })
    );

    // Geo (anota req.country para flags/policy)
    app.use(detectCountry);

    // CORS
    const corsOptions = {
      origin(origin, cb) {
        if (origin) {
          const last = corsLogTimestamps.get(origin) || 0;
          const now = Date.now();
          if (now - last >= CORS_LOG_TTL_MS) {
            corsLogTimestamps.set(origin, now);
            logger.info(`🛂 CORS origin: ${origin}`);
          }
        }
        if (!origin || ALLOWED_ORIGINS.includes(origin)) cb(null, true);
        else {
          logger.warn(`🚫 CORS blocked: ${origin}`);
          cb(new Error('CORS policy violation'));
        }
      },
      credentials: true,
      optionsSuccessStatus: 204
    };
    app.use(cors(corsOptions));
    app.options('*', cors(corsOptions));

    // Exponer CSRF header al front
    app.use((req, res, next) => {
      res.header('Access-Control-Expose-Headers', 'x-csrf-token');
      next();
    });

    // Body parsers + cookies
    app.use(express.json({ limit: jsonLimitBytes }));
    app.use(express.urlencoded({ extended: true, limit: jsonLimitBytes }));
    app.use(cookieParser());

    // Static (si sirves assets públicos)
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    app.use(express.static(path.join(__dirname, 'public')));

    // Rate limit global "soft"
    const RATE_LIMIT_SKIP_PREFIXES = [
      '/api/v1/relay/fetch',
      '/api/v1/relay/ack',
    ];

    app.use(rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => RATE_LIMIT_SKIP_PREFIXES.some((prefix) => req.path && req.path.startsWith(prefix)),
    }));
    logger.info('✅ Middleware setup complete');

    logger.info('🛤️ Mounting API routes...');
    // 3) Montar toda la API desde apps/api
    try {
      mountApi(app, { basePath: '/api' });
      logger.info('✅ API mounted under /api');
    } catch (apiError) {
      logger.error('❌ Error mounting API:', apiError.message);
      throw apiError;
    }

    logger.info('🔗 Setting up WebSocket...');
    // 4) WebSocket (namespace/handlers viven en apps/ws) - TODO: migrate to apps/ws
    let server, io;
    try {
      const wsResult = createWebSocketServer(app);
      server = wsResult.server;
      io = wsResult.io;
      app.set('io', io);
      logger.info(`✅ WebSocket ready (port ${env.WEBSOCKET_PORT})`);
    } catch (wsError) {
      logger.error('❌ Error setting up WebSocket:', wsError.message);
      throw wsError;
    }

    // 5) Workers (cron/colas) — TODO: migrate to apps/worker
    // try {
    //   await startWorkers?.();
    //   logger.info('🧵 Workers started');
    // } catch (e) {
    //   logger.warn(`⚠️ Workers not started: ${e?.message || e}`);
    // }

    logger.info('🏥 Setting up health endpoint and handlers...');
    // 6) Health + 404 + handlers
    const appInfo = loadAppInfo();

    app.get('/api/health', async (_req, res) => {
      try {
        const mongoStatus  = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const socketStatus = io ? 'active' : 'inactive';
        res.status(200).json({
          status: 'healthy',
          mongo: mongoStatus,
          websocket: socketStatus,
          version: appInfo.version,
          commit: appInfo.commit || undefined
        });
      } catch (error) {
        res.status(500).json({ status: 'unhealthy', error: error.message });
      }
    });

    // Security headers finales
    app.use((req, res, next) => {
      res.header('X-Frame-Options', 'DENY');
      res.header('X-Content-Type-Options', 'nosniff');
      res.header('Referrer-Policy', 'strict-origin-when-cross-origin');
      next();
    });

    // Handler de errores con CORS
    app.use((err, req, res, next) => {
      applyCorsHeaders(res, req.headers.origin);
      if (err) {
        logger.error(`❌ Global error: ${err.message}`);
        return res.status(500).json({ error: err.message });
      }
      next();
    });

    // 404
    app.use((req, res) => {
      applyCorsHeaders(res, req.headers.origin);
      res.status(404).json({ error: 'Not Found' });
    });

    logger.info('🔧 Setting up process handlers...');
    // Eventos de proceso
    process.on('uncaughtException', (err) => {
      console.error('🔥 Uncaught:', err);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('⚠️ UnhandledRejection:', reason);
    });

    logger.info('🚀 Starting HTTP server...');
    // 7) Levantar HTTP server (lo hace apps/ws internamente)
    server.listen(PORT, async () => {
      logger.info(`🚀 Server listening on port ${PORT}`);
      logger.info(`🩺 Health: http://localhost:${PORT}/api/health`);
      logger.info('✅ Server startup complete');
      
      // 8) Telegram bot disabled for memory optimization
      logger.info('🤖 Telegram bot disabled to reduce memory usage');
    });

  } catch (error) {
    logger.error(`❌ Server startup failed: ${error.message}`);
    logger.error(`❌ Error stack: ${error.stack}`);
    console.error('Full error object:', error);
    
    // Solo terminar el proceso en errores críticos
    if (error.message?.includes('MONGO_URI') || 
        error.code === 'EADDRINUSE' ||
        error.code === 'EACCES') {
      process.exit(1);
    } else {
      logger.warn('⚠️ Non-critical error during startup, attempting to continue...');
    }
  }
};

const gracefulShutdown = async (signal) => {
  logger.info(`👋 Received ${signal}. Shutting down...`);
  try {
    await mongoose.connection.close();
    logger.info('🛑 MongoDB disconnected');
  } catch (err) {
    logger.warn(`⚠️ Error closing MongoDB connection: ${err?.message || err}`);
  }

  if (memServer) {
    try {
      await memServer.stop();
      logger.info('🧪 In-memory Mongo server stopped');
    } catch (err) {
      logger.warn(`⚠️ Error stopping in-memory Mongo server: ${err?.message || err}`);
    }
  }

  process.exit(0);
};

process.once('SIGINT', () => gracefulShutdown('SIGINT'));
process.once('SIGTERM', () => gracefulShutdown('SIGTERM'));

startServer();
