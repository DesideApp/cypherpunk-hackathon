import crypto from 'crypto';
import User from '#modules/users/models/user.model.js';
import ConversationMessage from '#modules/history/models/message.model.js';
import config from '#config/appConfig.js';
import { createPresignedUpload, createPresignedDownload } from '#modules/attachments/services/r2Storage.js';
import logger from '#config/logger.js';
import {
  vaultUploadAttempts,
  vaultUploadSuccess,
  vaultUploadFailure,
} from '#modules/attachments/services/attachmentMetrics.js';
import {
  shouldBlock as shouldBlockAbuse,
  recordAbuseEvent,
} from '#modules/relay/services/relayAbuse.service.js';

function getTierDefinition(tier) {
  if (!tier) return config.tiers.free;
  const key = tier === 'basic' ? 'free' : tier;
  return config.tiers[key] || config.tiers.free;
}

function resolveGraceAttachmentLimit(tierKey) {
  const limits = config.attachmentVault.graceMaxUploadBytes || {};
  if (tierKey && typeof tierKey === 'string' && limits[tierKey] != null) {
    return limits[tierKey];
  }
  if (tierKey?.startsWith?.('org')) {
    return limits.pro ?? limits.plus ?? limits.free ?? 0;
  }
  if (limits.plus != null && tierKey === 'pro') {
    return limits.pro;
  }
  return limits.free ?? 0;
}

export async function postPresignAttachment(req, res) {
  try {
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: 'unauthorized' });

    const block = shouldBlockAbuse({ scope: 'wallet', id: wallet });
    if (block) {
      if (Number.isFinite(block.retryAfterSeconds) && block.retryAfterSeconds > 0) {
        res.set('Retry-After', String(Math.max(1, Math.ceil(block.retryAfterSeconds))));
      }
      logger.warn('attachment_presign_blocked', {
        wallet,
        ip: req.ip,
        reason: block.reason || 'abuse',
        retryAfterSeconds: block.retryAfterSeconds ?? null,
      });
      return res.status(429).json({
        error: 'temporarily_blocked',
        detail: {
          reason: block.reason || 'abuse',
          retryAfterSeconds: block.retryAfterSeconds ?? null,
        },
      });
    }

    const { mimeType, sizeBytes, hash } = req.body || {};
    const size = Number.isFinite(sizeBytes) ? sizeBytes : Number(sizeBytes);
    if (!Number.isFinite(size) || size <= 0) {
      return res.status(400).json({ error: 'invalid_size', message: 'sizeBytes must be > 0' });
    }

    if (size > config.attachmentVault.maxUploadBytes) {
      recordAbuseEvent({ scope: 'wallet', id: wallet, reason: 'invalid_attachment_size' });
      return res.status(413).json({
        error: 'attachment-too-large',
        maxBytes: config.attachmentVault.maxUploadBytes,
        sizeBytes: size,
      });
    }

    const user = await User.findOne(
      { wallet },
      {
        relayTier: 1,
        relayQuotaBytes: 1,
        relayUsedBytes: 1,
        relayOverflowGracePct: 1,
        vaultQuotaBytes: 1,
        vaultUsedBytes: 1,
        vaultTTLSeconds: 1,
      }
    ).lean();

    const tierKey = (user?.relayTier === 'basic' ? 'free' : user?.relayTier) || 'free';
    const tierDef = getTierDefinition(tierKey);
    const quotaBytes = Number.isFinite(user?.vaultQuotaBytes)
      ? user.vaultQuotaBytes
      : tierDef.vaultQuotaBytes;
    const usedBytes = Number.isFinite(user?.vaultUsedBytes)
      ? user.vaultUsedBytes
      : 0;

    const relayQuotaBytes = Number.isFinite(user?.relayQuotaBytes)
      ? user.relayQuotaBytes
      : tierDef.quotaBytes;
    const relayUsedBytes = Number.isFinite(user?.relayUsedBytes)
      ? user.relayUsedBytes
      : 0;
    const relayOverflowGracePct = Number.isFinite(user?.relayOverflowGracePct)
      ? user.relayOverflowGracePct
      : Number.isFinite(tierDef.overflowGracePct)
        ? tierDef.overflowGracePct
        : 0;
    const relayGraceLimitBytes = Math.floor(
      relayQuotaBytes * (1 + Math.max(0, relayOverflowGracePct) / 100)
    );
    const isInRelayGrace = relayUsedBytes > relayQuotaBytes;
    if (isInRelayGrace) {
      const graceLimitBytes = resolveGraceAttachmentLimit(tierKey);
      if (graceLimitBytes <= 0 || size > graceLimitBytes) {
        return res.status(409).json({
          error: 'attachments-limited-in-grace',
          details: {
            tier: tierKey,
            maxBytes: Math.max(0, graceLimitBytes),
            requestedBytes: size,
          },
        });
      }
    }

    if (usedBytes + size > quotaBytes) {
      return res.status(409).json({
        error: 'vault-quota-exceeded',
        details: {
          quotaBytes,
          usedBytes,
          incomingBytes: size,
        },
      });
    }

    const ttlSeconds = Number.isFinite(user?.vaultTTLSeconds)
      ? user.vaultTTLSeconds
      : tierDef.vaultTtlSeconds;

    const objectKey = `${wallet}/${crypto.randomUUID()}`;
    const expiresAt = ttlSeconds ? new Date(Date.now() + ttlSeconds * 1000) : null;

    vaultUploadAttempts.inc();

    try {
      const presign = await createPresignedUpload({
        key: objectKey,
        contentType: typeof mimeType === 'string' && mimeType.trim() ? mimeType.trim() : 'application/octet-stream',
        expiresInSeconds: config.attachmentVault.uploadUrlTtlSeconds,
      });

      vaultUploadSuccess.inc({ wallet });

      return res.status(200).json({
        data: {
          uploadUrl: presign.uploadUrl,
          objectKey: presign.key,
          bucket: presign.bucket,
          expiresAt,
          mimeType: presign.contentType || mimeType || 'application/octet-stream',
          sizeBytes: size,
          hash: typeof hash === 'string' && hash.trim() ? hash.trim() : null,
        },
      });
    } catch (error) {
      vaultUploadFailure.inc({ reason: error?.code || error?.name || 'presign_failed' });
      logger.error('attachment_presign_failed', {
        wallet,
        error: error?.message || error,
      });
      return res.status(500).json({ error: 'failed_to_presign', message: error?.message || 'presign failed' });
    }
  } catch (err) {
    logger.error('attachment_presign_unexpected', {
      error: err?.message || err,
    });
    return res.status(500).json({ error: 'failed_to_presign', message: err?.message || 'unexpected error' });
  }
}

export async function getAttachmentDownloadUrl(req, res) {
  try {
    const wallet = req.user?.wallet;
    if (!wallet) return res.status(401).json({ error: 'unauthorized' });

    const objectKey = req.params?.objectKey;
    if (!objectKey) {
      return res.status(400).json({ error: 'invalid_object_key' });
    }

    const message = await ConversationMessage.findOne({
      'attachments.key': objectKey,
      participants: wallet,
    }, { attachments: 1 }).lean();

    if (!message) {
      return res.status(404).json({ error: 'attachment_not_found' });
    }

    const downloadUrl = await createPresignedDownload({ key: objectKey });

    return res.status(200).json({
      data: {
        downloadUrl,
        expiresIn: config.attachmentVault.uploadUrlTtlSeconds,
      },
    });
  } catch (err) {
    logger.error('attachment_presign_download_failed', {
      error: err?.message || err,
    });
    return res.status(500).json({ error: 'failed_to_presign_download', message: err?.message || 'unexpected error' });
  }
}
