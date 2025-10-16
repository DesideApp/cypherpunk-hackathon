import User from "#modules/users/models/user.model.js";
import Notification from "#modules/users/models/notification.model.js";
import { verifySignature } from "#utils/solanaUtils.js";

function isValidHttpUrl(s) {
  try {
    const u = new URL(String(s));
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * PUT /api/users/v1/me/profile
 * Actualiza nickname y/o avatar del usuario autenticado.
 */
export async function updateMyProfile(req, res) {
  try {
    const wallet = req.user?.wallet;
    if (!wallet) {
      return res.status(401).json({ error: "UNAUTHORIZED", nextStep: "REAUTHENTICATE" });
    }

    const { nickname, avatar, signature, message, social } = req.body || {};

    // nickname: string opcional, 1–32 chars (trim). null/"" → limpiar
    let nextNickname;
    if (typeof nickname !== "undefined") {
      if (nickname === null || (typeof nickname === "string" && !nickname.trim())) {
        nextNickname = null;
      } else if (typeof nickname === "string") {
        const n = nickname.trim();
        if (n.length < 1 || n.length > 32) {
          return res.status(400).json({ error: "INVALID_NICKNAME", nextStep: "FIX_INPUT" });
        }
        nextNickname = n;
      } else {
        return res.status(400).json({ error: "INVALID_NICKNAME", nextStep: "FIX_INPUT" });
      }
    }

    // avatar: string opcional (http/https), null/"" → limpiar
    let nextAvatar;
    if (typeof avatar !== "undefined") {
      if (avatar === null || (typeof avatar === "string" && !avatar.trim())) {
        nextAvatar = null;
      } else if (typeof avatar === "string") {
        const a = avatar.trim();
        if (!/^https?:\/\//i.test(a) || !isValidHttpUrl(a)) {
          return res.status(400).json({ error: "INVALID_AVATAR_URL", nextStep: "FIX_INPUT" });
        }
        nextAvatar = a;
      } else {
        return res.status(400).json({ error: "INVALID_AVATAR_URL", nextStep: "FIX_INPUT" });
      }
    }

    // social.x: opcional, normaliza @, valida 1–32 y charset
    let nextX;
    if (social && Object.prototype.hasOwnProperty.call(social, 'x')) {
      const raw = social.x;
      if (raw === null || (typeof raw === 'string' && !raw.trim())) {
        nextX = null;
      } else if (typeof raw === 'string') {
        const cleaned = raw.trim().replace(/^@/, '');
        if (cleaned.length < 1 || cleaned.length > 32 || !/^[A-Za-z0-9_]+$/.test(cleaned)) {
          return res.status(400).json({ error: "INVALID_X_HANDLE", nextStep: "FIX_INPUT" });
        }
        nextX = cleaned;
      } else {
        return res.status(400).json({ error: "INVALID_X_HANDLE", nextStep: "FIX_INPUT" });
      }
    }

    // social.website: opcional http/https
    let nextWebsite;
    if (social && Object.prototype.hasOwnProperty.call(social, 'website')) {
      const raw = social.website;
      if (raw === null || (typeof raw === 'string' && !raw.trim())) {
        nextWebsite = null;
      } else if (typeof raw === 'string') {
        const w = raw.trim();
        if (!/^https?:\/\//i.test(w) || !isValidHttpUrl(w)) {
          return res.status(400).json({ error: "INVALID_WEBSITE_URL", nextStep: "FIX_INPUT" });
        }
        nextWebsite = w;
      } else {
        return res.status(400).json({ error: "INVALID_WEBSITE_URL", nextStep: "FIX_INPUT" });
      }
    }

    const $set = {};
    if (typeof nextNickname !== "undefined") $set.nickname = nextNickname;
    if (typeof nextAvatar !== "undefined") $set.avatar = nextAvatar;

    if (typeof nextX !== 'undefined') $set['social.x'] = nextX;
    if (typeof nextWebsite !== 'undefined') $set['social.website'] = nextWebsite;

    if (Object.keys($set).length === 0) {
      return res.status(400).json({ error: "NO_CHANGES", nextStep: "NO_ACTION" });
    }

    const user = await User.findOneAndUpdate(
      { wallet },
      { $set },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ error: "USER_NOT_FOUND", nextStep: "REGISTER_WALLET" });
    }

    // Firma opcional: si viene y es válida, registramos una notificación
    if (signature && message && typeof signature === 'string' && typeof message === 'string') {
      try {
        const ok = verifySignature(message, signature, wallet);
        if (ok) {
          await Notification.create({
            pubkey: wallet,
            type: 'profile_update',
            data: {
              nickname: user.nickname || null,
              avatar: user.avatar || null,
              message,
            },
          });
        }
      } catch (e) {
        // No bloquea la respuesta principal
        console.warn("⚠️ No se pudo registrar notificación de profile_update:", e?.message || e);
      }
    }

    return res.status(200).json({
      message: "✅ Profile updated",
      nickname: user.nickname || null,
      avatar: user.avatar || null,
      social: {
        x: user.social?.x || null,
        website: user.social?.website || null,
      },
    });
  } catch (error) {
    console.error("❌ updateMyProfile error:", error);
    return res.status(500).json({ error: "PROFILE_UPDATE_FAILED", nextStep: "RETRY" });
  }
}
