import User from "#modules/users/models/user.model.js";
import Contact from "#modules/contacts/models/contact.model.js";

const PUBKEY_REGEX = /^([1-9A-HJ-NP-Za-km-z]{32,44})$/;

function normalizeUser(user) {
  if (!user) return null;
  return {
    registered: true,
    pubkey: user.wallet,
    nickname: user.nickname || null,
    avatar: user.avatar || null,
    social: {
      x: user.social?.x || null,
      website: user.social?.website || null,
    },
  };
}

function applyRelationship(base, relation) {
  if (!base) return { registered: false };
  return {
    ...base,
    relationship: relation?.status ?? "none",
    blocked: relation?.blocked ?? false,
  };
}

export async function findUserByPubkey(req, res) {
  try {
    const { pubkey } = req.params;
    const requesterPubkey = req.user?.wallet;

    if (!pubkey || !PUBKEY_REGEX.test(pubkey)) {
      return res.status(400).json({ error: "INVALID_PUBKEY", nextStep: "CHECK_INPUT" });
    }

    const user = await User.findOne({ wallet: pubkey }).lean();

    if (!user) {
      return res.status(200).json({ registered: false });
    }

    let relationship = "none";
    let blocked = false;

    if (requesterPubkey) {
      const contact = await Contact.findOne({
        owner: requesterPubkey,
        contact: pubkey,
      }).lean();

      if (contact) {
        relationship = contact.status;
        blocked = contact.blocked || false;
      }
    }

    return res.status(200).json(
      applyRelationship(normalizeUser(user), { status: relationship, blocked })
    );
  } catch (error) {
    console.error("❌ Error checking user:", error);
    return res.status(500).json({
      error: "USER_LOOKUP_FAILED",
      nextStep: "RETRY",
    });
  }
}

export async function findUsersByPubkeys(req, res) {
  try {
    const requester = req.user?.wallet || null;
    const { pubkeys } = req.body || {};

    if (!Array.isArray(pubkeys) || pubkeys.length === 0) {
      return res.status(400).json({ error: "MISSING_PUBKEYS", nextStep: "CHECK_INPUT" });
    }

    if (pubkeys.length > 200) {
      return res.status(400).json({ error: "TOO_MANY_PUBKEYS", nextStep: "REDUCE_BATCH" });
    }

    const normalized = Array.from(
      new Set(
        pubkeys
          .filter((pk) => typeof pk === "string")
          .map((pk) => pk.trim())
          .filter((pk) => PUBKEY_REGEX.test(pk))
      )
    );

    if (normalized.length === 0) {
      return res.status(400).json({ error: "INVALID_PUBKEYS", nextStep: "CHECK_INPUT" });
    }

    const users = await User.find({ wallet: { $in: normalized } }).lean();
    const userMap = new Map(users.map((u) => [u.wallet, normalizeUser(u)]));

    let relationsMap = new Map();
    if (requester) {
      const relations = await Contact.find({
        owner: requester,
        contact: { $in: normalized },
      })
        .select({ contact: 1, status: 1, blocked: 1 })
        .lean();

      relationsMap = new Map(relations.map((rel) => [rel.contact, rel]));
    }

    const results = normalized.map((pk) => {
      const base = userMap.get(pk) || { registered: false, pubkey: pk };
      const relation = relationsMap.get(pk);
      return applyRelationship(base, relation);
    });

    return res.status(200).json({
      results,
      notRegistered: normalized.filter((pk) => !userMap.has(pk)),
    });
  } catch (error) {
    console.error("❌ Batch user lookup failed:", error);
    return res.status(500).json({
      error: "USER_BATCH_LOOKUP_FAILED",
      nextStep: "RETRY",
    });
  }
}
