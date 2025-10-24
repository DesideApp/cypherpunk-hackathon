import mongoose from 'mongoose';
import User from '#modules/users/models/user.model.js';
import Stats from '#modules/stats/models/stats.model.js';

function parseDateSafe(v) {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function resolveRange(query) {
  const now = new Date();
  const fromQ = query.from || query.rangeStart;
  const toQ = query.to || query.rangeEnd;
  const period = (query.period || '').toString().toLowerCase();

  const to = parseDateSafe(toQ) || now;
  let from = parseDateSafe(fromQ);

  if (!from) {
    switch (period) {
      case '1h': from = new Date(to.getTime() - 60 * 60 * 1000); break;
      case '7d': from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000); break;
      case '30d': from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000); break;
      case '90d': from = new Date(to.getTime() - 90 * 24 * 60 * 60 * 1000); break;
      case '1d':
      default:
        from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
        break;
    }
  }
  if (from > to) { const tmp = from; from = to; to = tmp; }
  return { from, to };
}

function startOfDay(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export async function getAdoptionOverview(req, res) {
  try {
    const { from, to } = resolveRange(req.query);
    const db = mongoose.connection.db;

    // Signups by day
    const signups = await User.aggregate([
      { $match: { registeredAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateTrunc: { date: '$registeredAt', unit: 'day' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    // DAU/WAU/MAU at range end (distinct by wallet)
    const endDay = startOfDay(to);
    const dau = await User.distinct('wallet', { lastLogin: { $gte: endDay, $lte: to } }).then(a => a.length);
    const wauStart = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const mauStart = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const wau = await User.distinct('wallet', { lastLogin: { $gte: wauStart, $lte: to } }).then(a => a.length);
    const mau = await User.distinct('wallet', { lastLogin: { $gte: mauStart, $lte: to } }).then(a => a.length);

    // DM conversion over range from Stats.events
    const dmStarted = await Stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': 'dm_started', 'events.timestamp': { $gte: from, $lte: to } } },
      { $count: 'n' }
    ]).then(r => r[0]?.n || 0);

    const dmAccepted = await Stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': 'dm_accepted', 'events.timestamp': { $gte: from, $lte: to } } },
      { $count: 'n' }
    ]).then(r => r[0]?.n || 0);

    const acceptRate = dmStarted > 0 ? Number(((dmAccepted / dmStarted) * 100).toFixed(2)) : null;

    // Totals
    const totalUsers = await User.estimatedDocumentCount();
    const newUsers = await User.countDocuments({ registeredAt: { $gte: from, $lte: to } });

    const series = signups.map(s => ({ timestamp: s._id, value: s.count }));

    const payload = {
      range: { from: from.toISOString(), to: to.toISOString() },
      users: {
        total: totalUsers,
        new: newUsers,
        dau, wau, mau,
      },
      dm: {
        started: dmStarted,
        accepted: dmAccepted,
        acceptRate,
      },
      signups: {
        history: series,
      },
    };

    return res.status(200).json(payload);
  } catch (error) {
    console.error('❌ [stats:admin] adoption overview failed:', error?.message || error);
    return res.status(500).json({ error: 'FAILED_TO_COMPUTE_ADOPTION', message: error?.message || 'Internal error' });
  }
}

export default { getAdoptionOverview };

