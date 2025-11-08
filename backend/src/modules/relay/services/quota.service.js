// src/modules/relay/services/quota.service.js
//
// NOTE: This is a simplified version for the hackathon submission.
// The production implementation includes advanced quota management,
// transaction handling, and retry logic. Full implementation available
// in private repository.

import config from '#config/appConfig.js';
import User from '#modules/users/models/user.model.js';
import { createModuleLogger } from '#config/logger.js';

const log = createModuleLogger({ module: 'relay.quotaService' });

/**
 * @typedef {Object} QuotaContext
 * @property {string} wallet
 * @property {number} incomingBytes
 * @property {string} tier
 * @property {string} rawTier
 * @property {number} quotaBytes
 * @property {number} usedBytes
 * @property {number} gracePct
 * @property {number} allowedWithGrace
 * @property {number} perMessageCap
 * @property {number} warningRatio
 * @property {number} criticalRatio
 */

/**
 * @typedef {Object} QuotaResult
 * @property {boolean} allowed
 * @property {'payload-too-large'|'relay-quota-exceeded'=} reason
 * @property {Record<string, unknown>=} details
 */

/**
 * Calcula los límites efectivos de un usuario.
 * Simplified implementation for hackathon submission.
 */
export async function resolveQuota({ wallet, incomingBytes, deltaBytes = undefined, session }) {
  const user = await User.findOne({ wallet }, null, { session }).lean();
  const rawTier = user?.relayTier || 'free';
  const tierKey = rawTier === 'basic' ? 'free' : rawTier;
  const tierDef = config.tiers[tierKey] || config.tiers.free;

  const quotaBytes = user?.relayQuotaBytes ?? tierDef.quotaBytes ?? 30 * 1024 * 1024;
  const usedBytes = user?.relayUsedBytes ?? 0;
  const gracePct = user?.relayOverflowGracePct ?? tierDef?.overflowGracePct ?? 0;
  const perMessageCap = user?.relayPerMessageMaxBytes ?? tierDef.perMessageMaxBytes ?? config.relayMaxBoxBytes;
  const warningRatio = tierDef?.warningRatio ?? config.relayWarningRatio ?? 0.8;
  const criticalRatio = tierDef?.criticalRatio ?? config.relayCriticalRatio ?? 0.95;

  return {
    wallet,
    incomingBytes,
    deltaBytes: typeof deltaBytes === 'number' ? deltaBytes : incomingBytes,
    tier: tierKey,
    rawTier,
    quotaBytes,
    usedBytes,
    gracePct,
    allowedWithGrace: Math.floor(quotaBytes * (1 + gracePct / 100)),
    perMessageCap,
    warningRatio,
    criticalRatio,
  };
}

/**
 * Determina si el mensaje cabe en los límites.
 * Simplified validation logic.
 */
export function checkQuota(ctx) {
  if (ctx.incomingBytes > ctx.perMessageCap) {
    return {
      allowed: false,
      reason: 'payload-too-large',
      details: { perMessageCap: ctx.perMessageCap, incomingBytes: ctx.incomingBytes },
    };
  }

  const projectedUsage = ctx.usedBytes + (ctx.deltaBytes ?? ctx.incomingBytes);
  if (projectedUsage > ctx.allowedWithGrace) {
    return {
      allowed: false,
      reason: 'relay-quota-exceeded',
      details: {
        quotaBytes: ctx.quotaBytes,
        usedBytes: ctx.usedBytes,
        allowedMaxBytes: ctx.allowedWithGrace,
      },
    };
  }

  return { allowed: true };
}

/**
 * Aplica la cuota utilizando un RelayStore inyectado.
 * NOTE: Production version includes MongoDB transactions and retry logic.
 * This is a simplified implementation for demonstration purposes.
 */
export async function applyQuota(initialCtx, store, reserveInput, options = {}) {
  try {
    const freshCtx = await resolveQuota({
      wallet: initialCtx.wallet,
      incomingBytes: initialCtx.incomingBytes,
      deltaBytes: initialCtx.deltaBytes,
    });

    const quotaCheck = checkQuota(freshCtx);
    if (!quotaCheck.allowed) {
      const err = new Error('relay-quota-exceeded');
      err.code = quotaCheck.reason;
      err.details = quotaCheck.details;
      throw err;
    }

    const opResult = await store.reserveAndUpsert(reserveInput);
    const delta = reserveInput.boxSize - (opResult.previousBoxSize ?? 0);
    const newUsedBytes = Math.max(0, freshCtx.usedBytes + delta);

    await User.updateOne(
      { wallet: freshCtx.wallet },
      { $set: { relayUsedBytes: newUsedBytes } }
    );

    return { result: opResult, newUsedBytes };
  } catch (error) {
    log.error('quota_apply_failed', {
      wallet: initialCtx.wallet,
      error: error?.message || error,
    });
    throw error;
  }
}

export default {
  resolveQuota,
  checkQuota,
  applyQuota,
};
