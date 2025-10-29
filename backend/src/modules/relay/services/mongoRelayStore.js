import RelayMessage from '../models/relayMessage.model.js';
import { RelayStore } from './relayStore.interface.js';

function normalizeId(doc) {
  if (!doc) return null;
  return {
    id: String(doc._id),
    from: doc.from,
    to: doc.to,
    box: doc.box,
    boxSize: doc.boxSize,
    iv: doc.iv ?? null,
    messageType: doc.messageType || 'text',
    meta: doc.meta ?? null,
    timestamps: {
      createdAt: doc.createdAt,
      enqueuedAt: doc.timestamps?.enqueuedAt ?? doc.createdAt,
      deliveredAt: doc.timestamps?.deliveredAt ?? null,
      acknowledgedAt: doc.timestamps?.acknowledgedAt ?? null,
    },
    status: doc.status || 'pending',
  };
}

class MongoRelayStore extends RelayStore {
  async findById(id, session) {
    const query = RelayMessage.findById(id);
    if (session) query.session(session);
    const doc = await query.lean();
    return doc ? normalizeId(doc) : null;
  }

  async findByAgreement(wallet, agreementId, session) {
    const query = RelayMessage.findOne(
      { to: wallet, 'meta.agreementId': agreementId },
      null
    );
    if (session) query.session(session);
    const doc = await query.lean();
    return doc ? normalizeId(doc) : null;
  }

  async findManyByIds(wallet, ids, session) {
    if (!ids?.length) return [];
    const query = RelayMessage.find({ _id: { $in: ids }, to: wallet }).sort({ createdAt: 1 });
    if (session) query.session(session);
    const docs = await query.lean();
    return docs.map(normalizeId);
  }

  async reserveAndUpsert(input) {
    const session = input.session ?? null;
    const now = new Date();

    const existing = await RelayMessage.findById(input.messageId, null, { session }).lean();
    const created = !existing;
    const enqueuedAt = existing?.timestamps?.enqueuedAt ?? now;

    const updateDoc = {
      to: input.to,
      from: input.from,
      box: input.box,
      boxSize: input.boxSize,
      iv: input.iv ?? null,
      messageType: input.messageType,
      meta: input.meta ?? null,
      status: 'pending',
      'timestamps.enqueuedAt': enqueuedAt,
    };

    if (!existing && input.meta == null) {
      updateDoc.meta = null;
    }

    await RelayMessage.updateOne(
      { _id: input.messageId },
      {
        $set: updateDoc,
        ...(created ? { $setOnInsert: { _id: input.messageId, createdAt: now } } : {}),
      },
      { session, upsert: true }
    );

    const createdAt = existing?.createdAt ?? now;
    const updated = created ? { ...updateDoc, createdAt } : updateDoc;
    const updatedAt = created ? now : new Date();

    return {
      created,
      previousBoxSize: existing?.boxSize ?? 0,
      createdAt,
      updatedAt,
      document: {
        id: input.messageId,
        ...updated,
        timestamps: {
          createdAt,
          enqueuedAt,
          deliveredAt: existing?.timestamps?.deliveredAt ?? null,
          acknowledgedAt: existing?.timestamps?.acknowledgedAt ?? null,
        },
        status: 'pending',
      },
    };
  }

  async fetchMessages(wallet, options = {}) {
    const query = RelayMessage.find({ to: wallet }).sort({ createdAt: 1 });
    if (options.session) query.session(options.session);
    const docs = await query.lean();
    return docs.map(normalizeId);
  }

  async markDelivered(wallet, ids, session) {
    if (!ids.length) return;
    await RelayMessage.updateMany(
      { _id: { $in: ids }, to: wallet, status: { $ne: 'acknowledged' } },
      {
        $set: {
          status: 'delivered',
          'timestamps.deliveredAt': new Date(),
        },
      },
      { session }
    );
  }

  async ackMessages(wallet, ids, session) {
    if (!ids.length) {
      return { totalBytes: 0, deletedCount: 0 };
    }

    const findQuery = RelayMessage.find(
      { _id: { $in: ids }, to: wallet },
      { boxSize: 1 }
    );
    if (session) findQuery.session(session);
    const docs = await findQuery.lean();
    const totalBytes = docs.reduce((sum, doc) => sum + (doc.boxSize || 0), 0);

    const deleteQuery = RelayMessage.deleteMany({ _id: { $in: ids }, to: wallet });
    if (session) deleteQuery.session(session);
    const result = await deleteQuery;

    return {
      totalBytes,
      deletedCount: result?.deletedCount ?? docs.length,
    };
  }

  async purgeMailbox(wallet, session) {
    const findQuery = RelayMessage.find({ to: wallet }, { boxSize: 1 });
    if (session) findQuery.session(session);
    const docs = await findQuery.lean();
    const freedBytes = docs.reduce((sum, doc) => sum + (doc.boxSize || 0), 0);

    const deleteQuery = RelayMessage.deleteMany({ to: wallet });
    if (session) deleteQuery.session(session);
    const result = await deleteQuery;

    return {
      deleted: result?.deletedCount ?? docs.length,
      freedBytes,
    };
  }

  async recalcUsage(wallet, session) {
    const pipeline = [
      { $match: { to: wallet } },
      { $group: { _id: null, bytes: { $sum: '$boxSize' } } },
    ];

    const options = {};
    if (session) options.session = session;

    const stats = await RelayMessage.aggregate(pipeline).option(options);
    const bytes = stats?.[0]?.bytes || 0;
    return bytes;
  }

  async listPendingIds(wallet) {
    const docs = await RelayMessage.find({ to: wallet }, { _id: 1 }).lean();
    return docs.map((doc) => String(doc._id));
  }

  async countExpired(wallet, threshold, session) {
    const pipeline = [
      { $match: { to: wallet, createdAt: { $lt: threshold } } },
      { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$boxSize' } } },
    ];
    const agg = await RelayMessage.aggregate(pipeline).option(session ? { session } : {});
    return {
      count: agg?.[0]?.count || 0,
      bytes: agg?.[0]?.bytes || 0,
    };
  }

  async deleteExpired(wallet, threshold, session) {
    const stats = await this.countExpired(wallet, threshold, session);
    if (stats.count === 0) {
      return { deleted: 0, freedBytes: 0 };
    }

    const deleteQuery = RelayMessage.deleteMany({ to: wallet, createdAt: { $lt: threshold } });
    if (session) deleteQuery.session(session);
    const result = await deleteQuery;

    return {
      deleted: result?.deletedCount ?? stats.count,
      freedBytes: stats.bytes,
    };
  }

  async mailboxSnapshot(wallet, session) {
    const pipeline = [
      { $match: { to: wallet } },
      { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$boxSize' } } },
    ];
    const agg = await RelayMessage.aggregate(pipeline).option(session ? { session } : {});
    return {
      count: agg?.[0]?.count || 0,
      bytes: agg?.[0]?.bytes || 0,
    };
  }

  async aggregatePending(limit = 20) {
    const pipeline = [
      { $group: { _id: '$to', count: { $sum: 1 }, bytes: { $sum: '$boxSize' }, oldest: { $min: '$createdAt' } } },
      { $match: { _id: { $ne: null } } },
      { $sort: { bytes: -1, count: -1 } },
      { $limit: limit },
    ];
    const rows = await RelayMessage.aggregate(pipeline);

    const totalsAgg = await RelayMessage.aggregate([
      { $group: { _id: null, count: { $sum: 1 }, bytes: { $sum: '$boxSize' } } },
    ]);
    const totals = totalsAgg?.[0] || { count: 0, bytes: 0 };
    return { rows, totals };
  }

  async aggregateMessageHistory(match, bucketMinutes) {
    const pipeline = [
      { $match: match },
      {
        $group: {
          _id: {
            $dateTrunc: {
              date: '$createdAt',
              unit: 'minute',
              binSize: bucketMinutes,
            },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];
    return RelayMessage.aggregate(pipeline);
  }

  async aggregateConnectionHistory(match, bucketMinutes) {
    const pipeline = [
      { $match: match },
      {
        $project: {
          bucket: {
            $dateTrunc: {
              date: '$createdAt',
              unit: 'minute',
              binSize: bucketMinutes,
            },
          },
          participants: ['$from', '$to'],
        },
      },
      { $unwind: '$participants' },
      {
        $group: {
          _id: {
            bucket: '$bucket',
            wallet: '$participants',
          },
        },
      },
      {
        $group: {
          _id: '$_id.bucket',
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ];
    return RelayMessage.aggregate(pipeline);
  }

  async distinct(field, match) {
    return RelayMessage.distinct(field, match);
  }
}

export default MongoRelayStore;
