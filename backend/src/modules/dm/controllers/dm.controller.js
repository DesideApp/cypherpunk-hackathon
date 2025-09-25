import mongoose from 'mongoose';
import Contact from "#modules/contacts/models/contact.model.js";
import User from "#modules/users/models/user.model.js";
import { io as ioExport } from "#shared/services/websocketServer.js";
import { isValidSolanaPubkey } from "#utils/pubkey.js";
import {
  ContactStatus,
  CONTACT_TTL_DAYS,
  REJECT_COOLDOWN_DAYS,
} from "#modules/contacts/contact.constants.js";

const DM_LEGACY_EVENTS_ENABLED = String(process.env.DM_LEGACY_EVENTS_ENABLED ?? 'false').toLowerCase() === 'true';

function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate()+n); return d; }
function redact(t) { if (!t) return t; return t.length > 128 ? t.slice(0,128)+"…" : t; }
function getIO(req) { return req.app?.get?.('io') || ioExport; }

/**
 * POST /api/dm/start
 * body: { to_pubkey, text }
 */
export async function sendInitialMessage(req, res, next) {
  try {
    const me = req.user?.wallet || req.user?.pubkey;
    const { to_pubkey, text } = req.body || {};
    if (!me) return res.status(401).json({ error: "unauthorized" });
    if (!isValidSolanaPubkey(to_pubkey)) return res.status(422).json({ error: "invalid_pubkey" });
    if (to_pubkey === me) return res.status(400).json({ error: "cannot_dm_self" });

    // bloqueos en ambos sentidos
    const [blockedByMe, blockedByPeer] = await Promise.all([
      Contact.findOne({ owner: me, contact: to_pubkey, status: ContactStatus.BLOCKED }).lean(),
      Contact.findOne({ owner: to_pubkey, contact: me, status: ContactStatus.BLOCKED }).lean(),
    ]);
    if (blockedByMe)  return res.status(403).json({ error: "you_blocked_peer" });
    if (blockedByPeer) return res.status(403).json({ error: "blocked_by_peer" });

    // cooldown tras reject (B->A CLOSED con denyUntil)
    const deny = await Contact.findOne({
      owner: to_pubkey, contact: me, status: ContactStatus.CLOSED, denyUntil: { $gt: new Date() },
    }).lean();
    if (deny) return res.status(429).json({ error: "cooldown_active" });

    // ¿destino registrado?
    const exists = await User.exists({ wallet: to_pubkey });
    if (!exists) return res.status(200).json({ registered: false });

    const now = new Date();
    const expiresAt = addDays(now, CONTACT_TTL_DAYS);

    let rel = await Contact.findOne({ owner: me, contact: to_pubkey });
    if (rel?.status === ContactStatus.ACCEPTED) {
      return res.status(409).json({ error: "already_accepted" });
    }
    if (rel && rel.status === ContactStatus.PENDING_OUT && rel.introSent) {
      return res.status(409).json({ error: "waiting_acceptance" });
    }

    if (!rel) {
      rel = await Contact.create({
        owner: me,
        contact: to_pubkey,
        status: ContactStatus.PENDING_OUT,
        introSent: !!text,
        introText: (text || '').slice(0, 3000),
        firstInteractionAt: now,
        expiresAt,
      });
    } else {
      rel.status = ContactStatus.PENDING_OUT;
      rel.introSent = !!text;
      rel.introText = (text || '').slice(0, 3000);
      rel.firstInteractionAt = rel.firstInteractionAt || now;
      rel.expiresAt = rel.expiresAt || expiresAt;
      await rel.save();
    }

    // notifica en tiempo real (+compat legacy)
    const io = getIO(req);
    io.to(to_pubkey).emit("dm_request", { from: me, preview: text ? redact(text) : "" });
    if (DM_LEGACY_EVENTS_ENABLED) {
      io.to(to_pubkey).emit("contact_request", { from: me });
    }

    return res.status(201).json({
      registered: true,
      conversation_id: rel._id,
      my_state: ContactStatus.PENDING_OUT,
      other_state: ContactStatus.PENDING_IN,
    });
  } catch (e) { next(e); }
}

/**
 * POST /api/dm/accept
 * body: { pubkey }  // solicitante A
 * • Transacción para evitar estados parciales
 */
export async function acceptDMRequest(req, res, next) {
  const session = await mongoose.startSession();
  try {
    const me = req.user?.wallet || req.user?.pubkey;
    const { pubkey } = req.body || {};
    if (!me || !pubkey) return res.status(400).json({ error: "bad_request" });

    await session.withTransaction(async () => {
      const rel = await Contact.findOne(
        { owner: pubkey, contact: me, status: ContactStatus.PENDING_OUT },
        null, { session }
      );
      if (!rel) throw Object.assign(new Error('not_found'), { status: 404 });

      // A (pubkey) -> me  pasa a ACCEPTED
      rel.status = ContactStatus.ACCEPTED;
      rel.expiresAt = undefined;
      await rel.save({ session });

      // me -> A  crear/actualizar espejo
      await Contact.updateOne(
        { owner: me, contact: pubkey },
        { $set: { status: ContactStatus.ACCEPTED }, $unset: { expiresAt: 1 } },
        { upsert: true, session }
      );
    });

    const io = getIO(req);
    io.to(pubkey).emit("dm_accepted", { from: me });
    if (DM_LEGACY_EVENTS_ENABLED) {
      io.to(pubkey).emit("contact_accepted", { from: me });
    }

    return res.json({ ok: true });
  } catch (e) {
    if (e?.status === 404) return res.status(404).json({ error: "not_found" });
    next(e);
  } finally {
    session.endSession();
  }
}

/**
 * POST /api/dm/reject
 * body: { pubkey } // solicitante A
 */
export async function rejectDMRequest(req, res, next) {
  try {
    const me = req.user?.wallet || req.user?.pubkey;
    const { pubkey } = req.body || {};
    if (!me || !pubkey) return res.status(400).json({ error: "bad_request" });

    const rel = await Contact.findOne({ owner: pubkey, contact: me, status: ContactStatus.PENDING_OUT });
    if (!rel) return res.status(404).json({ error: "not_found" });

    await Contact.deleteOne({ _id: rel._id });

    const denyUntil = addDays(new Date(), REJECT_COOLDOWN_DAYS);
    await Contact.updateOne(
      { owner: me, contact: pubkey },
      { $set: { status: ContactStatus.CLOSED, denyUntil, introSent: false, introText: "", expiresAt: undefined } },
      { upsert: true }
    );

    const io = getIO(req);
    io.to(pubkey).emit("dm_rejected", { from: me });
    if (DM_LEGACY_EVENTS_ENABLED) {
      io.to(pubkey).emit("contact_removed", { from: me });
    }

    return res.json({ ok: true });
  } catch (e) { next(e); }
}

/**
 * POST /api/dm/cancel
 * body: { pubkey } // destinatario B (yo soy A)
 */
export async function cancelDMRequest(req, res, next) {
  try {
    const me = req.user?.wallet || req.user?.pubkey;
    const { pubkey } = req.body || {};
    if (!me || !pubkey) return res.status(400).json({ error: "bad_request" });

    const rel = await Contact.findOne({ owner: me, contact: pubkey, status: ContactStatus.PENDING_OUT });
    if (!rel) return res.status(404).json({ error: "not_found" });

    await Contact.deleteOne({ _id: rel._id });

    const io = getIO(req);
    io.to(pubkey).emit("dm_canceled", { from: me });
    return res.json({ ok: true });
  } catch (e) { next(e); }
}

/**
 * POST /api/dm/block
 * body: { pubkey } // bloqueo unilateral
 */
export async function blockPeer(req, res, next) {
  try {
    const me = req.user?.wallet || req.user?.pubkey;
    const { pubkey } = req.body || {};
    if (!me || !pubkey || pubkey === me) return res.status(400).json({ error: "bad_request" });

    await Contact.deleteMany({ $or: [{ owner: me, contact: pubkey }, { owner: pubkey, contact: me }] });

    await Contact.updateOne(
      { owner: me, contact: pubkey },
      { $set: { status: ContactStatus.BLOCKED, blocked: true } },
      { upsert: true }
    );

    const io = getIO(req);
    io.to(pubkey).emit("dm_blocked", { from: me });
    if (DM_LEGACY_EVENTS_ENABLED) {
      io.to(pubkey).emit("contact_blocked", { from: me });
    }
    return res.json({ ok: true });
  } catch (e) { next(e); }
}

/**
 * GET /api/dm?filter=general|unread|pending_out|pending_in
 */
export async function listDMs(req, res, next) {
  try {
    const me = req.user?.wallet || req.user?.pubkey;
    if (!me) return res.status(401).json({ error: "unauthorized" });

    const filter = String(req.query?.filter || "general");
    const accepted = await Contact.find({ owner: me, status: ContactStatus.ACCEPTED }).sort({ updatedAt: -1 }).lean();
    const outgoing = await Contact.find({ owner: me, status: ContactStatus.PENDING_OUT }).sort({ updatedAt: -1 }).lean();
    const incoming = await Contact.find({ contact: me, status: ContactStatus.PENDING_OUT }).sort({ updatedAt: -1 }).lean();

    let items = [];
    if (filter === "pending_out") items = outgoing;
    else if (filter === "pending_in") items = incoming;
    else if (filter === "unread") items = accepted;  // TODO: filtra por unread>0 cuando lo tengas
    else items = [...incoming, ...outgoing, ...accepted];

    return res.json({ items });
  } catch (e) { next(e); }
}
