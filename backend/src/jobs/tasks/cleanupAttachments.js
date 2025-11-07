import ConversationMessage from '#modules/history/models/message.model.js';
import User from '#modules/users/models/user.model.js';
import { deleteObject } from '#modules/attachments/services/r2Storage.js';
import { createModuleLogger } from '#config/logger.js';
import {
  vaultPurgeCounter,
  vaultUsageGauge,
} from '#modules/attachments/services/attachmentMetrics.js';

const log = createModuleLogger({ module: 'jobs.cleanupAttachments' });

export async function cleanupAttachments({ dryRun = false } = {}) {
  const now = new Date();
  const summary = {
    inspectedMessages: 0,
    attachmentsPurged: 0,
    freedBytes: 0,
    failures: 0,
    dryRun,
  };

  const cursor = ConversationMessage.find(
    {
      'attachments.0': { $exists: true },
      $or: [
        { 'attachments.expiresAt': { $lte: now } },
        { deletedAt: { $ne: null } },
      ],
    },
    { attachments: 1, sender: 1, deletedAt: 1 }
  ).lean().cursor();

  for await (const message of cursor) {
    const { attachments = [], deletedAt = null } = message;
    if (!attachments.length) continue;

    const toRemove = attachments.filter(att => {
      if (!att) return false;
      if (deletedAt) return true;
      if (!att.expiresAt) return false;
      try {
        const exp = att.expiresAt instanceof Date ? att.expiresAt : new Date(att.expiresAt);
        return exp <= now;
      } catch {
        return false;
      }
    });

    if (!toRemove.length) continue;

    summary.inspectedMessages += 1;

    const totalBytes = toRemove.reduce((sum, att) => sum + (Number(att?.sizeBytes) || 0), 0);
    const keys = toRemove.map(att => att.key).filter(Boolean);

    if (!dryRun) {
      for (const attachment of toRemove) {
        try {
          await deleteObject({ key: attachment.key });
          vaultPurgeCounter.inc({ reason: deletedAt ? 'message_deleted' : 'expired' });
        } catch (err) {
          summary.failures += 1;
          log.warn('attachment_delete_error', {
            key: attachment?.key,
            error: err?.message || err,
          });
        }
      }

      if (keys.length) {
        await ConversationMessage.updateOne(
          { _id: message._id },
          { $pull: { attachments: { key: { $in: keys } } } }
        ).catch(err => {
          summary.failures += 1;
          log.warn('attachment_pull_failed', {
            messageId: message._id,
            error: err?.message || err,
          });
        });
      }

      if (totalBytes > 0 && message.sender) {
        const result = await User.findOneAndUpdate(
          { wallet: message.sender },
          { $inc: { vaultUsedBytes: -totalBytes } },
          { new: true }
        ).lean().catch(err => {
          summary.failures += 1;
          log.warn('attachment_user_usage_update_failed', {
            wallet: message.sender,
            error: err?.message || err,
          });
          return null;
        });

        if (result) {
          const updatedUsage = Math.max(0, Number(result.vaultUsedBytes) || 0);
          vaultUsageGauge.labels(message.sender).set(updatedUsage);
        }
      }
    }

    summary.attachmentsPurged += toRemove.length;
    summary.freedBytes += totalBytes;
  }

  return summary;
}

export default cleanupAttachments;
