import { Router } from 'express';
import rateLimit from 'express-rate-limit';

import { getBuyBlinkMetadata, executeBuyBlink } from '../controllers/buyBlink.controller.js';
import { env } from '#config/env.js';

const router = Router();

const metadataLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
});

const executeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
});

// Minimal OPTIONS for Blink preflight (CORS + action headers)
router.options('/buy', (req, res) => {
  const chain = String(env.SOLANA_CLUSTER || 'mainnet-beta').toLowerCase();
  const caip = chain === 'devnet' ? 'solana:devnet' : 'solana:mainnet';
  res.set({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'x-blockchain-ids': caip,
    'x-action-version': '2.4',
  });
  return res.status(204).end();
});

router
  .route('/buy')
  .get(metadataLimiter, getBuyBlinkMetadata)
  .post(executeLimiter, executeBuyBlink);

export default router;
