import Contact from "#modules/contacts/models/contact.model.js";
import User from "#modules/users/models/user.model.js";
import { io } from "#shared/services/websocketServer.js";
import mongoose from "mongoose";
import { ContactStatus } from "#modules/contacts/contact.constants.js";

const DM_LEGACY_EVENTS_ENABLED = String(process.env.DM_LEGACY_EVENTS_ENABLED ?? 'false').toLowerCase() === 'true';
const emitToWallet = (wallet, event, payload) => {
  // Filtra eventos legacy de contactos si el toggle está desactivado
  if (!DM_LEGACY_EVENTS_ENABLED && String(event).startsWith('contact_')) return;
  io.to(wallet).emit(event, payload);
};

export async function checkWalletExists(req, res) {
  try {
    const { pubkey } = req.params;
    if (!pubkey) {
      return res.status(400).json({ error: "Public key is required", nextStep: "CHECK_INPUT" });
    }
    const isRegistered = await User.exists({ wallet: pubkey });
    res.status(200).json({ data: { registered: !!isRegistered } });
  } catch (error) {
    console.error("❌ Error checking registered wallet:", error);
    res.status(500).json({ error: "Internal server error", nextStep: "RETRY" });
  }
}

export const getContacts = async (req, res) => {
  try {
    const wallet = req.user.wallet;

    const accepted = await Contact.find({ owner: wallet, status: ContactStatus.ACCEPTED }).lean();
    const pending_out = await Contact.find({ owner: wallet, status: ContactStatus.PENDING_OUT }).lean();
    const pending_in = await Contact.find({ contact: wallet, status: ContactStatus.PENDING_OUT }).lean();

    const confirmed = accepted.map(c => ({ wallet: c.contact, status: "confirmed" })); // compat nombre
    const pending = pending_out.map(c => ({ wallet: c.contact, status: "pending" }));  // compat nombre
    const incoming = pending_in.map(r => ({ wallet: r.owner, status: "incoming" }));   // compat nombre

    res.status(200).json({ data: { confirmed, pending, incoming } });
  } catch (err) {
    console.error("❌ Error al obtener contactos:", err);
    res.status(500).json({ error: "Failed to fetch contacts", nextStep: "RETRY" });
  }
};

export const sendContactRequest = async (req, res) => {
  try {
    const { pubkey } = req.body;
    const owner = req.user?.wallet;
    if (!owner) return res.status(401).json({ error: "UNAUTHORIZED", nextStep: "REAUTHENTICATE" });
    if (!pubkey || pubkey === owner) return res.status(400).json({ error: "INVALID_PUBKEY", nextStep: "CHECK_INPUT" });

    const userExists = await User.exists({ wallet: pubkey });
    if (!userExists) return res.status(404).json({ error: "USER_NOT_FOUND", nextStep: "REGISTER_WALLET" });

    // si bloqueado en cualquiera de los dos sentidos
    const iBlock = await Contact.exists({ owner, contact: pubkey, status: ContactStatus.BLOCKED });
    if (iBlock) return res.status(403).json({ error: "CONTACT_BLOCKED", nextStep: "UNBLOCK_FIRST" });
    const peerBlocks = await Contact.exists({ owner: pubkey, contact: owner, status: ContactStatus.BLOCKED });
    if (peerBlocks) return res.status(403).json({ error: "BLOCKED_BY_PEER" });

    const existing = await Contact.findOne({ owner, contact: pubkey });
    if (existing) return res.status(409).json({ error: "CONTACT_ALREADY_EXISTS", nextStep: "NO_ACTION" });

    await new Contact({ owner, contact: pubkey, status: ContactStatus.PENDING_OUT }).save();


    emitToWallet(pubkey, "contact_request", { from: owner });
    res.status(201).json({ message: "REQUEST_SENT", nextStep: "WAIT_FOR_APPROVAL" });
  } catch (err) {
    console.error("❌ [sendContactRequest] Error:", err);
    if (err.code === 11000) return res.status(409).json({ error: "DUPLICATE_REQUEST", nextStep: "NO_ACTION" });
    res.status(500).json({ error: "FAILED_TO_SEND", details: err.message });
  }
};

const supportsTransactions = () => {
  try {
    const topology = mongoose.connection?.client?.topology;
    return topology?.hasSessionSupport?.() ?? false;
  } catch (err) {
    console.warn('⚠️ No se pudo determinar si Mongo soporta transacciones:', err?.message);
    return false;
  }
};

const startOptionalSession = async () => {
  if (!supportsTransactions()) return null;
  const session = await mongoose.startSession();
  session.startTransaction();
  return session;
};

export const acceptContactRequest = async (req, res) => {
  const session = await startOptionalSession();
  try {
    const { pubkey } = req.body;
    const owner = req.user.wallet;
    if (!pubkey) {
      if (session) await session.abortTransaction();
      return res.status(400).json({ error: "Public key is required", nextStep: "CHECK_INPUT" });
    }

    const baseRequest = Contact.findOne({ owner: pubkey, contact: owner, status: ContactStatus.PENDING_OUT });
    const contactRequest = session ? await baseRequest.session(session) : await baseRequest;
    if (!contactRequest) {
      if (session) await session.abortTransaction();
      return res.status(404).json({ error: "No pending request found", nextStep: "NO_ACTION" });
    }

    contactRequest.status = ContactStatus.ACCEPTED;
    contactRequest.expiresAt = undefined;
    await contactRequest.save(session ? { session } : undefined);

    const existingQuery = Contact.findOne({ owner, contact: pubkey });
    const existing = session ? await existingQuery.session(session) : await existingQuery;
    if (!existing) {
      await new Contact({ owner, contact: pubkey, status: ContactStatus.ACCEPTED }).save(session ? { session } : undefined);
    } else {
      existing.status = ContactStatus.ACCEPTED;
      existing.expiresAt = undefined;
      await existing.save(session ? { session } : undefined);
    }

    if (session) await session.commitTransaction();
    emitToWallet(pubkey, "contact_accepted", { from: owner });  // legacy
    io.to(pubkey).emit("dm_accepted", { from: owner });         // nuevo


    res.status(200).json({ message: "✅ Contacto aceptado", nextStep: "START_CHAT" });
  } catch (err) {
    if (session) await session.abortTransaction();
    console.error("❌ Error al aceptar contacto:", err);
    res.status(500).json({ error: "Failed to accept contact request", nextStep: "RETRY" });
  } finally {
    if (session) session.endSession();
  }
};

export const removeContact = async (req, res) => {
  const session = await startOptionalSession();
  try {
    const { pubkey } = req.body;
    const owner = req.user.wallet;
    if (!pubkey) {
      if (session) await session.abortTransaction();
      return res.status(400).json({ error: "Public key is required", nextStep: "CHECK_INPUT" });
    }

    const exists = await Contact.exists({ $or: [{ owner, contact: pubkey }, { owner: pubkey, contact: owner }] });
    if (!exists) {
      if (session) await session.abortTransaction();
      return res.status(404).json({ error: "Contact not found", nextStep: "NO_ACTION" });
    }

    const deleteQuery = Contact.deleteMany({ $or: [{ owner, contact: pubkey }, { owner: pubkey, contact: owner }] });
    if (session) await deleteQuery.session(session);
    else await deleteQuery;
    if (session) await session.commitTransaction();

    emitToWallet(pubkey, "contact_removed", { from: owner });
    io.to(pubkey).emit("dm_rejected", { from: owner }); // en contexto "pendiente" equivale a rechazo


    res.status(200).json({ message: "✅ Contacto eliminado", nextStep: "NO_ACTION" });
  } catch (err) {
    if (session) await session.abortTransaction();
    console.error("❌ Error al eliminar contacto:", err);
    res.status(500).json({ error: "Failed to remove contact", nextStep: "RETRY" });
  } finally {
    if (session) session.endSession();
  }
};

export const blockContact = async (req, res) => {
  const session = await startOptionalSession();
  try {
    const { pubkey } = req.body;
    const owner = req.user.wallet;
    if (!pubkey || pubkey === owner) {
      if (session) await session.abortTransaction();
      return res.status(400).json({ error: "Invalid public key", nextStep: "CHECK_INPUT" });
    }

    const deleteQuery = Contact.deleteMany({ $or: [{ owner, contact: pubkey }, { owner: pubkey, contact: owner }] });
    if (session) await deleteQuery.session(session);
    else await deleteQuery;

    const updateOpts = session ? { upsert: true, session } : { upsert: true };
    await Contact.updateOne(
      { owner, contact: pubkey },
      { $set: { status: ContactStatus.BLOCKED, blocked: true } },
      updateOpts
    );

    if (session) await session.commitTransaction();
    emitToWallet(pubkey, "contact_blocked", { from: owner });
    io.to(pubkey).emit("dm_blocked", { from: owner });


    res.status(200).json({ message: "✅ Contacto bloqueado", nextStep: "NO_ACTION" });
  } catch (err) {
    if (session) await session.abortTransaction();
    console.error("❌ Error al bloquear contacto:", err);
    res.status(500).json({ error: "Failed to block contact", nextStep: "RETRY" });
  } finally {
    if (session) session.endSession();
  }
};

export const unblockContact = async (req, res) => {
  const session = await startOptionalSession();
  try {
    const { pubkey } = req.body;
    const owner = req.user.wallet;
    if (!pubkey || pubkey === owner) {
      if (session) await session.abortTransaction();
      return res.status(400).json({ error: "Invalid public key", nextStep: "CHECK_INPUT" });
    }

    const baseQuery = Contact.findOne({ owner, contact: pubkey, status: ContactStatus.BLOCKED });
    const blocked = session ? await baseQuery.session(session) : await baseQuery;
    if (!blocked) {
      if (session) await session.abortTransaction();
      return res.status(404).json({ error: "Contact not found or not blocked", nextStep: "NO_ACTION" });
    }

    if (session) await blocked.deleteOne({ session });
    else await blocked.deleteOne();
    if (session) await session.commitTransaction();

    emitToWallet(pubkey, "contact_unblocked", { from: owner });
    io.to(pubkey).emit("dm_unblocked", { from: owner });


    res.status(200).json({ message: "✅ Contacto desbloqueado", nextStep: "NO_ACTION" });
  } catch (err) {
    if (session) await session.abortTransaction();
    console.error("❌ Error al desbloquear contacto:", err);
    res.status(500).json({ error: "Failed to unblock contact", nextStep: "RETRY" });
  } finally {
    if (session) session.endSession();
  }
};

/**
 * GET /api/contacts/status/:pubkey
 * Responde si el contacto está confirmado (ACCEPTED) para el usuario autenticado.
 * Devuelve isConfirmed (raíz) por compatibilidad con el front y un payload rico en data.
 */
export async function getContactStatus(req, res) {
  try {
    const owner = req.user?.wallet;
    const { pubkey } = req.params;

    if (!owner) {
      return res.status(401).json({ error: "UNAUTHORIZED", nextStep: "REAUTHENTICATE" });
    }

    if (!pubkey) {
      return res.status(400).json({ error: "INVALID_PUBKEY", nextStep: "CHECK_INPUT" });
    }

    if (pubkey === owner) {
      // No consideramos "self" como contacto confirmado
      res.set("Cache-Control", "private, max-age=3");
      return res.status(200).json({
        isConfirmed: false,
        data: { status: "self", isBlocked: false },
        nextStep: "NO_ACTION",
      });
    }

    // Buscamos relación en ambos sentidos (mínimo coste con índice {owner,contact})
    const [meToPeer, peerToMe] = await Promise.all([
      Contact.findOne({ owner, contact: pubkey }).select("status").lean(),
      Contact.findOne({ owner: pubkey, contact: owner }).select("status").lean(),
    ]);

    // Bloqueo en cualquiera de los dos sentidos
    const blockedByMe = meToPeer?.status === ContactStatus.BLOCKED;
    const blockedByPeer = peerToMe?.status === ContactStatus.BLOCKED;
    const isBlocked = !!(blockedByMe || blockedByPeer);

    let status = "none";
    let isConfirmed = false;

    if (isBlocked) {
      status = "blocked";
    } else if (meToPeer?.status === ContactStatus.ACCEPTED) {
      status = "confirmed";
      isConfirmed = true;
    } else if (meToPeer?.status === ContactStatus.PENDING_OUT) {
      status = "pending_out";
    } else if (peerToMe?.status === ContactStatus.PENDING_OUT) {
      status = "pending_in";
    } else {
      status = "none";
    }

    // Cache corto para aliviar llamadas repetidas del cliente
    res.set("Cache-Control", "private, max-age=3");

    // Respuesta compatible con tu hook (isConfirmed en raíz)
    return res.status(200).json({
      isConfirmed,
      data: {
        status,           // 'confirmed' | 'pending_out' | 'pending_in' | 'blocked' | 'none' | 'self'
        isBlocked,
        blockedBy: blockedByMe ? "me" : (blockedByPeer ? "peer" : null),
      },
    });
  } catch (err) {
    console.error("❌ CONTACT_STATUS_ERROR:", err);
    return res.status(500).json({ error: "INTERNAL_ERROR", nextStep: "RETRY" });
  }
}
