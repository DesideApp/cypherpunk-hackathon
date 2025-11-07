// src/modules/relay/services/quota.service.js
//
// Servicio responsable de resolver cuotas por usuario, validar límites y
// aplicarlos en coordinación con el RelayStore. Durante el siguiente paso
// implementaremos la lógica real; por ahora exponemos firmas y estructuras.

import mongoose from 'mongoose';
import config from '#config/appConfig.js';
import User from '#modules/users/models/user.model.js';
import { createModuleLogger } from '#config/logger.js';
import { relayReserveCounter, relayReserveBytesCounter, relayRejectionCounter } from '#modules/relay/services/relayMetrics.js';

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
 * @param {import('mongoose').ClientSession=} session
 * @returns {Promise<QuotaContext>}
 */
export async function resolveQuota({ wallet, incomingBytes, deltaBytes = undefined, session }) {
  const projection = {
    relayTier: 1,
    relayQuotaBytes: 1,
    relayUsedBytes: 1,
    relayOverflowGracePct: 1,
    relayPerMessageMaxBytes: 1,
  };
  const user = await User.findOne({ wallet }, projection, { session }).lean();

  const rawTier = user?.relayTier || 'free';
  const tierKey = rawTier === 'basic' ? 'free' : rawTier;
  const tierDef = config.tiers[tierKey] || config.tiers.free;

  const quotaBytes = Number.isFinite(user?.relayQuotaBytes) ? user.relayQuotaBytes : tierDef.quotaBytes;
  const usedBytes = Number.isFinite(user?.relayUsedBytes) ? user.relayUsedBytes : 0;
  const gracePct = Number.isFinite(user?.relayOverflowGracePct)
    ? user.relayOverflowGracePct
    : Number.isFinite(tierDef?.overflowGracePct)
    ? tierDef.overflowGracePct
    : 0;
  const perMessageCap = Number.isFinite(user?.relayPerMessageMaxBytes)
    ? user.relayPerMessageMaxBytes
    : (tierDef.perMessageMaxBytes ?? config.relayMaxBoxBytes);
  const warningRatio = Number.isFinite(tierDef?.warningRatio) ? tierDef.warningRatio : config.relayWarningRatio;
  const criticalRatio = Number.isFinite(tierDef?.criticalRatio) ? tierDef.criticalRatio : config.relayCriticalRatio;

  const allowedWithGrace = Math.floor(quotaBytes * (1 + gracePct / 100));

  return {
    wallet,
    incomingBytes,
    deltaBytes: typeof deltaBytes === 'number' ? deltaBytes : incomingBytes,
    tier: tierKey,
    rawTier,
    quotaBytes,
    usedBytes,
    gracePct,
    allowedWithGrace,
    perMessageCap,
    warningRatio,
    criticalRatio,
  };
}

/**
 * Determina si el mensaje cabe en los límites.
 * @param {QuotaContext} ctx
 * @returns {QuotaResult}
 */
export function checkQuota(ctx) {
  if (ctx.incomingBytes > ctx.perMessageCap) {
    return {
      allowed: false,
      reason: 'payload-too-large',
      details: { perMessageCap: ctx.perMessageCap, incomingBytes: ctx.incomingBytes },
    };
  }

  const delta = ctx.deltaBytes ?? ctx.incomingBytes;
  const projectedUsage = ctx.usedBytes + Math.max(0, delta);
  if (projectedUsage > ctx.allowedWithGrace) {
    return {
      allowed: false,
      reason: 'relay-quota-exceeded',
      details: {
        quotaBytes: ctx.quotaBytes,
        usedBytes: ctx.usedBytes,
        incomingBytes: ctx.incomingBytes,
        allowedMaxBytes: ctx.allowedWithGrace,
        gracePct: ctx.gracePct,
      },
    };
  }

  return { allowed: true };
}

/**
 * Aplica la cuota utilizando un RelayStore inyectado, garantizando consistencia
 * a través de transacciones Mongo. Reintenta ante conflictos transitorios.
 */
export async function applyQuota(initialCtx, store, reserveInput, options = {}) {
  const maxAttempts = options.maxAttempts || 2;

  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const session = await mongoose.startSession();
    try {
      let opResult = null;
      let newUsedBytes = 0;

      await session.withTransaction(async () => {
        const freshCtx = await resolveQuota({
          wallet: initialCtx.wallet,
          incomingBytes: initialCtx.incomingBytes,
          deltaBytes: initialCtx.deltaBytes,
          session,
        });

        const quotaCheck = checkQuota(freshCtx);
        if (!quotaCheck.allowed) {
          const err = new Error('relay-quota-exceeded');
          err.code = quotaCheck.reason;
          err.details = quotaCheck.details;
          relayRejectionCounter.labels(quotaCheck.reason || 'unknown').inc();
          log.warn('quota_rejected', {
            wallet: freshCtx.wallet,
            reason: quotaCheck.reason,
            details: quotaCheck.details,
          });
          throw err;
        }

        opResult = await store.reserveAndUpsert({
          ...reserveInput,
          session,
        });

        const delta = reserveInput.boxSize - opResult.previousBoxSize;
        newUsedBytes = Math.max(0, freshCtx.usedBytes + delta);

        if (newUsedBytes > freshCtx.allowedWithGrace) {
          const err = new Error('relay-quota-exceeded');
          err.code = 'relay-quota-exceeded';
          err.details = {
            quotaBytes: freshCtx.quotaBytes,
            usedBytes: freshCtx.usedBytes,
            incomingBytes: initialCtx.incomingBytes,
            deltaBytes: delta,
            allowedMaxBytes: freshCtx.allowedWithGrace,
            gracePct: freshCtx.gracePct,
          };
          throw err;
        }

        await User.updateOne(
          { wallet: freshCtx.wallet },
          { $set: { relayUsedBytes: newUsedBytes } },
          { session }
        );
      });

      session.endSession();
      relayReserveCounter.inc();
      relayReserveBytesCounter.inc(reserveInput.boxSize);
      return { result: opResult, newUsedBytes };
    } catch (error) {
      session.endSession();

      if (error?.code === 'payload-too-large' || error?.code === 'relay-quota-exceeded') {
        throw error;
      }

      const mongoCode = error?.errorLabels || [];
      const retryable =
        (Array.isArray(mongoCode) && (mongoCode.includes('TransientTransactionError') || mongoCode.includes('UnknownTransactionCommitResult'))) ||
        error?.code === 112; // WriteConflict

      if (!retryable || attempt === maxAttempts) {
        lastError = error;
        break;
      }

      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 15 * attempt));
    }
  }

  if (lastError) {
    log.error('quota_apply_failed', {
      wallet: initialCtx.wallet,
      error: lastError?.stack || lastError?.message || lastError,
    });
    throw lastError;
  }

  const genericError = new Error('relay-quota-apply-failed');
  log.error('quota_apply_failed', {
    wallet: initialCtx.wallet,
    error: genericError.message,
  });
  throw genericError;
}

export default {
  resolveQuota,
  checkQuota,
  applyQuota,
};
