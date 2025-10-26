import mongoose from 'mongoose';
import User from '#modules/users/models/user.model.js';
import Stats from '#modules/stats/models/stats.model.js';
import logger from '#config/logger.js';

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
    const db = mongoose.connection?.db;
    if (!db) {
      return res.status(200).json({
        range: { from: from.toISOString(), to: to.toISOString() },
        users: { total: 0, new: 0, dau: 0, wau: 0, mau: 0 },
        dm: { started: 0, accepted: 0, acceptRate: null },
        signups: { history: [] },
      });
    }

    // Signups by day
    const signups = await User.aggregate([
      { $match: { registeredAt: { $gte: from, $lte: to } } },
      { $group: { _id: { $dateTrunc: { date: '$registeredAt', unit: 'day' } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).catch(() => []);

    // DAU/WAU/MAU at range end (distinct by wallet)
    const endDay = startOfDay(to);
    const dau = await User.distinct('wallet', { lastLogin: { $gte: endDay, $lte: to } }).then(a => a.length).catch(() => 0);
    const wauStart = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    const mauStart = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
    const wau = await User.distinct('wallet', { lastLogin: { $gte: wauStart, $lte: to } }).then(a => a.length).catch(() => 0);
    const mau = await User.distinct('wallet', { lastLogin: { $gte: mauStart, $lte: to } }).then(a => a.length).catch(() => 0);

    // DM conversion over range from Stats.events
    const dmStarted = await Stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': 'dm_started', 'events.timestamp': { $gte: from, $lte: to } } },
      { $count: 'n' }
    ]).then(r => r[0]?.n || 0).catch(() => 0);

    const dmAccepted = await Stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': 'dm_accepted', 'events.timestamp': { $gte: from, $lte: to } } },
      { $count: 'n' }
    ]).then(r => r[0]?.n || 0).catch(() => 0);

    const acceptRate = dmStarted > 0 ? Number(((dmAccepted / dmStarted) * 100).toFixed(2)) : null;

    // Totals
    const totalUsers = await User.estimatedDocumentCount().catch(() => 0);
    const newUsers = await User.countDocuments({ registeredAt: { $gte: from, $lte: to } }).catch(() => 0);

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

    try { const DBG = String(process.env.STATS_DEBUG || 'false').toLowerCase() === 'true'; if (DBG) logger.info(`[adoption] users total=${totalUsers} new=${newUsers} dau=${dau}`); } catch{}
    return res.status(200).json(payload);
  } catch (error) {
    const { from, to } = resolveRange(req.query || {});
    return res.status(200).json({
      range: { from: from.toISOString(), to: to.toISOString() },
      users: { total: 0, new: 0, dau: 0, wau: 0, mau: 0 },
      dm: { started: 0, accepted: 0, acceptRate: null },
      signups: { history: [] },
    });
  }
}

export default { getAdoptionOverview };

// Helpers
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }

/**
 * GET /api/v1/stats/admin/adoption/cohorts
 * Query: weeks (default 8), activity=messages|login (default messages)
 * Returns cohort rows with retention per week (1..N) based on activity.
 */
export async function getCohorts(req, res) {
  try {
    const weeks = Math.min(12, Math.max(1, parseInt(req.query.weeks || '8', 10) || 8));
    const activity = (req.query.activity || 'messages').toString().toLowerCase();
    const now = new Date();
    const endOfThisWeek = new Date(now);
    // Align to start of week Monday 00:00
    const startOfWeek = (d) => {
      const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      const day = s.getDay();
      const diff = (day + 6) % 7; // Monday
      s.setDate(s.getDate() - diff);
      s.setHours(0, 0, 0, 0);
      return s;
    };
    const week0 = startOfWeek(endOfThisWeek);

    const cohorts = [];
    for (let w = weeks; w >= 1; w -= 1) {
      const cohortStart = addDays(week0, -7 * w);
      const cohortEnd = addDays(cohortStart, 7);
      // Users registered in this cohort week
      const cohortUsers = await User.find({
        registeredAt: { $gte: cohortStart, $lt: cohortEnd }
      }, { wallet: 1 }).lean().catch(() => []);
      const wallets = cohortUsers.map(u => u.wallet).filter(Boolean);
      const size = wallets.length;
      const retention = [];
      if (size === 0) {
        // Fill zeros
        for (let i = 1; i <= weeks; i += 1) retention.push({ week: i, active: 0, pct: 0 });
        cohorts.push({ cohortStart, size, retention });
        continue;
      }

      for (let i = 1; i <= weeks; i += 1) {
        const weekStart = addDays(cohortStart, 7 * i);
        const weekEnd = addDays(weekStart, 7);
        if (weekStart > now) { retention.push({ week: i, active: 0, pct: 0 }); continue; }
        let activeCount = 0;
        if (activity === 'login') {
          activeCount = await User.countDocuments({ wallet: { $in: wallets }, lastLogin: { $gte: weekStart, $lt: weekEnd } });
        } else {
          // messages: any from/to in this bucket
          let senders = [], receivers = [];
          try {
            [senders, receivers] = await Promise.all([
              mongoose.connection.db.collection('relaymessages').distinct('from', { createdAt: { $gte: weekStart, $lt: weekEnd }, from: { $in: wallets } }),
              mongoose.connection.db.collection('relaymessages').distinct('to', { createdAt: { $gte: weekStart, $lt: weekEnd }, to: { $in: wallets } }),
            ]);
          } catch {}
          const set = new Set();
          for (const w of senders) set.add(w);
          for (const w of receivers) set.add(w);
          activeCount = Array.from(set).length;
        }
        const pct = size > 0 ? Number(((activeCount / size) * 100).toFixed(2)) : 0;
        retention.push({ week: i, active: activeCount, pct });
      }
      cohorts.push({ cohortStart, size, retention });
    }

    return res.status(200).json({ weeks, generatedAt: now.toISOString(), cohorts });
  } catch (error) {
    const weeks = Math.min(12, Math.max(1, parseInt(req.query?.weeks || '8', 10) || 8));
    return res.status(200).json({ weeks, generatedAt: new Date().toISOString(), cohorts: [] });
  }
}

/**
 * GET /api/v1/stats/admin/adoption/funnel
 * Query: period=30d | from/to, windowDays=1|7
 * Returns funnel counts per step and activation A (explicit/inferred) and B_action metrics.
 */
export async function getFunnel(req, res) {
  try {
    const { from, to } = resolveRange(req.query);
    const windowDays = Math.min(30, Math.max(1, parseInt(req.query.windowDays || '1', 10) || 1));
    const windowMs = windowDays * 24 * 60 * 60 * 1000;

    // Base users registered in period
    const baseUsers = await User.find({ registeredAt: { $gte: from, $lte: to } }, { wallet: 1, registeredAt: 1 }).lean().catch(() => []);
    const wallets = baseUsers.map(u => u.wallet).filter(Boolean);

    // dm_started earliest per user
    const dmAgg = await Stats.aggregate([
      { $unwind: '$events' },
      { $match: { 'events.type': 'dm_started', 'events.timestamp': { $gte: from, $lte: to }, user: { $in: wallets } } },
      { $sort: { 'events.timestamp': 1 } },
      { $group: { _id: '$user', ts: { $first: '$events.timestamp' }, to: { $first: '$events.data.to' } } },
    ]).catch(() => []);
    const dmMap = new Map(dmAgg.map(d => [d._id, { ts: d.ts, to: d.to }]));

    // Contacts accepted explicit (owner=wallet, status=ACCEPTED)
    let acceptedDocs = [];
    try {
      acceptedDocs = await mongoose.connection.db.collection('contacts').find({ status: 'ACCEPTED', owner: { $in: wallets } }, { projection: { owner: 1, updatedAt: 1 } }).toArray();
    } catch {}
    const accMap = new Map();
    for (const d of acceptedDocs) {
      const cur = accMap.get(d.owner);
      if (!cur || (d.updatedAt && d.updatedAt < cur)) accMap.set(d.owner, d.updatedAt || null);
    }

    // First sent & first received (any + action)
    const [firstSent, firstRecvAny, firstRecvAction] = await Promise.all([
      RelayMessage.aggregate([
        { $match: { from: { $in: wallets }, createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$from', ts: { $min: '$createdAt' } } },
      ]).catch(() => []),
      RelayMessage.aggregate([
        { $match: { to: { $in: wallets }, createdAt: { $gte: from, $lte: to } } },
        { $group: { _id: '$to', ts: { $min: '$createdAt' } } },
      ]).catch(() => []),
      RelayMessage.aggregate([
        { $match: { to: { $in: wallets }, createdAt: { $gte: from, $lte: to }, messageType: { $in: ['blink-action', 'file', 'image', 'audio', 'video'] } } },
        { $group: { _id: '$to', ts: { $min: '$createdAt' } } },
      ]).catch(() => []),
    ]);
    const firstSentMap = new Map(firstSent.map(d => [d._id, d.ts]));
    const firstRecvAnyMap = new Map(firstRecvAny.map(d => [d._id, d.ts]));
    const firstRecvActionMap = new Map(firstRecvAction.map(d => [d._id, d.ts]));

    // Build funnel metrics
    const steps = { registered: 0, dm_started: 0, accepted_explicit: 0, accepted_inferred: 0, first_sent: 0, first_received_any: 0, first_received_action: 0 };
    const timesA = []; const timesB = [];

    for (const u of baseUsers) {
      const reg = new Date(u.registeredAt).getTime(); steps.registered += 1;
      const cutoff = reg + windowMs;
      const dm = dmMap.get(u.wallet);
      if (dm && dm.ts && dm.ts.getTime() <= cutoff) steps.dm_started += 1;

      const accTs = accMap.get(u.wallet) ? new Date(accMap.get(u.wallet)).getTime() : null;
      if (accTs && accTs <= cutoff) { steps.accepted_explicit += 1; timesA.push(accTs - reg); }
      else {
        // infer acceptance via first received ANY in window
        const recAny = firstRecvAnyMap.get(u.wallet) ? new Date(firstRecvAnyMap.get(u.wallet)).getTime() : null;
        if (recAny && recAny <= cutoff) { steps.accepted_inferred += 1; timesA.push(recAny - reg); }
      }

      const sentTs = firstSentMap.get(u.wallet) ? new Date(firstSentMap.get(u.wallet)).getTime() : null;
      if (sentTs && sentTs <= cutoff) steps.first_sent += 1;

      const recvAnyTs = firstRecvAnyMap.get(u.wallet) ? new Date(firstRecvAnyMap.get(u.wallet)).getTime() : null;
      if (recvAnyTs && recvAnyTs <= cutoff) steps.first_received_any += 1;

      const recvActionTs = firstRecvActionMap.get(u.wallet) ? new Date(firstRecvActionMap.get(u.wallet)).getTime() : null;
      if (recvActionTs && recvActionTs <= cutoff) { steps.first_received_action += 1; timesB.push(recvActionTs - reg); }
    }

    const pct = (num, den) => den > 0 ? Number(((num / den) * 100).toFixed(2)) : 0;
    const p50 = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a,b)=>a-b); const m = Math.floor((s.length-1)/2); return Math.round(s[m]); };
    const p95 = (arr) => { if (!arr.length) return 0; const s = [...arr].sort((a,b)=>a-b); const idx = Math.ceil(0.95 * s.length) - 1; return Math.round(s[Math.max(0, idx)]); };

    const activationA = {
      count: steps.accepted_explicit + steps.accepted_inferred,
      conversionPct: pct(steps.accepted_explicit + steps.accepted_inferred, steps.registered),
      explicit: steps.accepted_explicit,
      inferred: steps.accepted_inferred,
      ttaP50ms: p50(timesA),
      ttaP95ms: p95(timesA),
    };
    const activationB = {
      count: steps.first_received_action,
      conversionPct: pct(steps.first_received_action, steps.registered),
      ttaP50ms: p50(timesB),
      ttaP95ms: p95(timesB),
      anyReceived: steps.first_received_any,
    };

    const funnel = [
      { step: 'registered', count: steps.registered, pct: 100 },
      { step: 'dm_started', count: steps.dm_started, pct: pct(steps.dm_started, steps.registered) },
      { step: 'accepted_total', count: activationA.count, pct: activationA.conversionPct },
      { step: 'first_sent', count: steps.first_sent, pct: pct(steps.first_sent, steps.registered) },
      { step: 'first_received_action', count: steps.first_received_action, pct: activationB.conversionPct },
    ];

    return res.status(200).json({ range: { from: from.toISOString(), to: to.toISOString() }, windowDays, funnel, activationA, activationB });
  } catch (error) {
    const { from, to } = resolveRange(req.query || {});
    return res.status(200).json({
      range: { from: from.toISOString(), to: to.toISOString() },
      windowDays: Math.min(30, Math.max(1, parseInt(req.query?.windowDays || '1', 10) || 1)),
      funnel: [],
      activationA: { count: 0, conversionPct: 0, explicit: 0, inferred: 0, ttaP50ms: 0, ttaP95ms: 0 },
      activationB: { count: 0, conversionPct: 0, ttaP50ms: 0, ttaP95ms: 0, anyReceived: 0 },
    });
  }
}
